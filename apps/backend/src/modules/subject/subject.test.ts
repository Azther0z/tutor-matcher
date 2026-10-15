import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import { Prisma } from "../../generated/prisma/client.ts";

const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findSubjects = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findSubject = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const create = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const update = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const captureBookings = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = {
  user: { findUnique: findUser },
  subject: { findMany: findSubjects, findFirst: findSubject, create, update },
  booking: { updateMany: captureBookings },
};
const transaction = jest.fn<
  (callback: (client: typeof tx) => Promise<unknown>, options?: unknown) => Promise<unknown>
>(async (callback) => callback(tx));
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: { ...tx, $transaction: transaction },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const USER_ID = "11000000-0000-4000-8000-000000000001";
const TUTOR_ID = "11000000-0000-4000-8000-000000000002";
const SUBJECT_ID = "11000000-0000-4000-8000-000000000003";
const base = "/api/profiles/me/tutor/subjects";
const token = signAuthToken({ sub: USER_ID, email: "tutor@example.com", isAdmin: false });
const auth = (test: request.Test) => test.set("Authorization", `Bearer ${token}`);
const input = {
  name: "English",
  description: "Speaking practice",
  hourlyRate: "125.50",
  format: "ONLINE",
};
const original = {
  id: SUBJECT_ID,
  name: "English",
  description: null,
  hourlyRate: new Prisma.Decimal("100.00"),
  format: "ONLINE",
};

beforeEach(() => {
  jest.clearAllMocks();
  findUser.mockResolvedValue({ tutorId: TUTOR_ID });
  findSubjects.mockResolvedValue([original]);
  findSubject.mockResolvedValue(original);
  create.mockResolvedValue({
    id: SUBJECT_ID,
    ...input,
    hourlyRate: new Prisma.Decimal(input.hourlyRate),
  });
  update.mockResolvedValue({
    id: SUBJECT_ID,
    ...input,
    hourlyRate: new Prisma.Decimal(input.hourlyRate),
  });
  captureBookings.mockResolvedValue({ count: 1 });
});

describe("PROF-6 owned subjects", () => {
  it.each(["get", "post", "put"])("requires authentication for %s", async (method) => {
    const client = request(app);
    await client[method as "get" | "post" | "put"](
      method === "put" ? `${base}/${SUBJECT_ID}` : base
    )
      .send(input)
      .expect(401);
    expect(findUser).not.toHaveBeenCalled();
  });

  it.each([null, { tutorId: null }])(
    "rejects a caller without Tutor capability (%j)",
    async (user) => {
      findUser.mockResolvedValue(user);
      await auth(request(app).get(base)).expect(403);
      await auth(request(app).post(base).send(input)).expect(403);
      await auth(request(app).put(`${base}/${SUBJECT_ID}`).send(input)).expect(403);
      expect(create).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(captureBookings).not.toHaveBeenCalled();
    }
  );

  it("lists only offerings owned by the authenticated Tutor", async () => {
    const result = await auth(request(app).get(base)).expect(200);
    expect(result.body.subjects).toEqual([{ ...original, hourlyRate: "100.00" }]);
    expect(findSubjects).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tutorId: TUTOR_ID } })
    );
  });

  it("creates separate offerings with duplicate names, trims fields and derives ownership", async () => {
    create
      .mockResolvedValueOnce({ ...original, id: SUBJECT_ID })
      .mockResolvedValueOnce({ ...original, id: USER_ID });
    const first = await auth(
      request(app)
        .post(base)
        .send({ ...input, name: " English ", description: " Speaking practice " })
    ).expect(201);
    const second = await auth(request(app).post(base).send(input)).expect(201);
    expect(first.body.subject.id).not.toBe(second.body.subject.id);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { ...input, tutorId: TUTOR_ID },
      })
    );
    // No publication check: an approved, unpublished Tutor can manage subjects too.
    expect(findUser).toHaveBeenCalledWith({ where: { id: USER_ID }, select: { tutorId: true } });
  });

  it.each([
    { name: " " },
    { description: " " },
    { name: "x".repeat(101) },
    { description: "x".repeat(2001) },
    { format: "IN_PERSON" },
    { format: undefined },
    ...["0", "0.00", "-1", "1.001", "100000000", "1e2", "NaN", ""].map((hourlyRate) => ({
      hourlyRate,
    })),
    { tutorId: USER_ID },
  ])("rejects invalid or unauthorized input (%j) without writes", async (patch) => {
    await auth(
      request(app)
        .post(base)
        .send({ ...input, ...patch })
    ).expect(400);
    await auth(
      request(app)
        .put(`${base}/${SUBJECT_ID}`)
        .send({ ...input, ...patch })
    ).expect(400);
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(captureBookings).not.toHaveBeenCalled();
  });

  it.each(["0.01", "1", "99.99", "99999999.99"])(
    "accepts positive THB rate %s",
    async (hourlyRate) => {
      await auth(
        request(app)
          .post(base)
          .send({ ...input, hourlyRate })
      ).expect(201);
    }
  );

  it("does not expose or edit another Tutor's offering", async () => {
    findSubject.mockResolvedValue(null);
    await auth(request(app).put(`${base}/${SUBJECT_ID}`).send(input)).expect(404);
    expect(findSubject).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SUBJECT_ID, tutorId: TUTOR_ID } })
    );
    expect(update).not.toHaveBeenCalled();
    expect(captureBookings).not.toHaveBeenCalled();
  });

  it("captures only unsnapshotted bookings before updating only the selected subject", async () => {
    const result = await auth(request(app).put(`${base}/${SUBJECT_ID}`).send(input)).expect(200);
    expect(result.body.subject).toEqual({ id: SUBJECT_ID, ...input });
    expect(captureBookings).toHaveBeenCalledWith({
      where: { subjectId: SUBJECT_ID, subjectName: null },
      data: {
        subjectName: original.name,
        subjectDescription: null,
        subjectHourlyRate: original.hourlyRate,
        subjectFormat: "ONLINE",
      },
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SUBJECT_ID, tutorId: TUTOR_ID }, data: input })
    );
    expect(captureBookings.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0]
    );
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("rejects malformed identifiers before database access", async () => {
    await auth(request(app).put(`${base}/not-a-uuid`).send(input)).expect(400);
    expect(findUser).not.toHaveBeenCalled();
  });

  it("returns a retryable conflict for concurrent edits", async () => {
    update.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Conflict", { code: "P2034", clientVersion: "7" })
    );
    const result = await auth(request(app).put(`${base}/${SUBJECT_ID}`).send(input)).expect(409);
    expect(result.body.message).toContain("try again");
  });
});
