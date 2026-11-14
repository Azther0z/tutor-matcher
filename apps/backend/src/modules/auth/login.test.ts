// AUTH-2 unit test for the backend `login` function (auth.service.ts), written for the
// test plan's backend-function requirement: every statement in `login` runs at least once.
// The database and the account-restriction lookup are replaced with mocks, so no
// PostgreSQL is needed.
import bcrypt from "bcryptjs";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

type StoredUser = {
  id: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  isAdmin: boolean;
};

const userFindUnique = jest.fn<(args: unknown) => Promise<StoredUser | null>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const findAccountRestriction = jest.fn<(userId: string) => Promise<unknown>>();

class AccountRestrictedError extends Error {
  constructor(public readonly restriction: unknown) {
    super("This account is restricted");
    this.name = "AccountRestrictedError";
  }
}

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { user: { findUnique: userFindUnique, update: userUpdate } },
}));
jest.unstable_mockModule("../admin/account-actions.ts", () => ({
  AccountRestrictedError,
  findAccountRestriction,
}));
jest.unstable_mockModule("../../lib/email.ts", () => ({
  buildPasswordResetUrl: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

const { login, InvalidCredentialsError } = await import("./auth.service.ts");

const PASSWORD = "Passw0rd!";
// Cost 4 keeps the test fast; `login` accepts any bcrypt cost.
const BCRYPT_HASH = bcrypt.hashSync(PASSWORD, 4);

const somchai: StoredUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "somchai@example.com",
  password: BCRYPT_HASH,
  firstName: "Somchai",
  lastName: "Jaidee",
  isAdmin: false,
};

beforeEach(() => {
  jest.clearAllMocks();
  findAccountRestriction.mockResolvedValue(null);
  userUpdate.mockResolvedValue({});
});

// Equivalence classes for login(email, password)
//  1 email is registered (valid)                  2 email is not registered (invalid)
//  3 password matches the stored bcrypt hash      4 password does not match the bcrypt hash
//    (valid)                                        (invalid)
//  5 legacy plain-text password that matches      6 legacy plain-text password that does
//    (valid, upgraded to bcrypt)                    not match (invalid)
//  7 account not suspended or banned (valid)      8 account suspended or banned (invalid)
describe("login (AUTH-2)", () => {
  it("UT-1 registered user with the right password gets their profile (1, 3, 7)", async () => {
    userFindUnique.mockResolvedValue(somchai);

    await expect(login({ email: somchai.email, password: PASSWORD })).resolves.toEqual({
      id: somchai.id,
      email: somchai.email,
      firstName: "Somchai",
      lastName: "Jaidee",
      isAdmin: false,
    });
    expect(userFindUnique).toHaveBeenCalledWith({ where: { email: somchai.email } });
    expect(findAccountRestriction).toHaveBeenCalledWith(somchai.id);
    expect(userUpdate).not.toHaveBeenCalled(); // already hashed: nothing to upgrade
  });

  it("UT-2 wrong password is rejected with the generic message (1, 4)", async () => {
    userFindUnique.mockResolvedValue(somchai);

    const attempt = login({ email: somchai.email, password: "Wrong-pass1" });
    await expect(attempt).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(attempt).rejects.toThrow("Invalid email or password");
    expect(findAccountRestriction).not.toHaveBeenCalled();
  });

  it("UT-3 unknown email gets the same message as a wrong password (2)", async () => {
    userFindUnique.mockResolvedValue(null);

    await expect(login({ email: "nobody@example.com", password: PASSWORD })).rejects.toThrow(
      "Invalid email or password"
    );
    expect(findAccountRestriction).not.toHaveBeenCalled();
  });

  it("UT-4 matching legacy plain-text password logs in and is re-hashed (1, 5, 7)", async () => {
    userFindUnique.mockResolvedValue({ ...somchai, password: PASSWORD });

    await expect(login({ email: somchai.email, password: PASSWORD })).resolves.toMatchObject({
      id: somchai.id,
    });
    expect(userUpdate).toHaveBeenCalledTimes(1);
    const { where, data } = userUpdate.mock.calls[0]![0] as {
      where: { id: string };
      data: { password: string };
    };
    expect(where).toEqual({ id: somchai.id });
    expect(data.password).toMatch(/^\$2[aby]\$12\$/);
    expect(await bcrypt.compare(PASSWORD, data.password)).toBe(true);
  });

  it("UT-5 non-matching legacy plain-text password is rejected (1, 6)", async () => {
    userFindUnique.mockResolvedValue({ ...somchai, password: "development-only" });

    await expect(login({ email: somchai.email, password: PASSWORD })).rejects.toBeInstanceOf(
      InvalidCredentialsError
    );
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("UT-6 suspended or banned account cannot log in (1, 3, 8)", async () => {
    userFindUnique.mockResolvedValue(somchai);
    const restriction = { type: "SUSPENSION", reason: "Spam" };
    findAccountRestriction.mockResolvedValue(restriction);

    const attempt = login({ email: somchai.email, password: PASSWORD });
    await expect(attempt).rejects.toBeInstanceOf(AccountRestrictedError);
    await expect(attempt).rejects.toMatchObject({ restriction });
    expect(userUpdate).not.toHaveBeenCalled();
  });
});
