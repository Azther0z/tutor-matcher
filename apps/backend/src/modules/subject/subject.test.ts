import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import request from "supertest";
import { Prisma } from "../../generated/prisma/client.ts";

const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findSubjects = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findSubject = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const create = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const update = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const captureBookings = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const countLearningAreas = jest.fn<(...args: unknown[]) => Promise<number>>();
const tx = {
  user: { findUnique: findUser },
  learningArea: { count: countLearningAreas },
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
const MATHEMATICS = { id: "11000000-0000-4000-8000-000000000004", name: "Mathematics" };
const PHYSICS = { id: "11000000-0000-4000-8000-000000000005", name: "Physics" };
const AREA_IDS = [MATHEMATICS.id, PHYSICS.id];
const base = "/api/profiles/me/tutor/subjects";
const token = signAuthToken({ sub: USER_ID, email: "tutor@example.com", isAdmin: false });
const auth = (test: request.Test) => test.set("Authorization", `Bearer ${token}`);
const input = {
  name: "English",
  description: "Speaking practice",
  hourlyRate: "125.50",
  format: "ONLINE",
  learningAreaIds: AREA_IDS,
};
const offering = {
  name: input.name,
  description: input.description,
  hourlyRate: input.hourlyRate,
  format: input.format,
};
const areaRows = [{ learningArea: MATHEMATICS }, { learningArea: PHYSICS }];
const areaLinks = AREA_IDS.map((id) => ({ learningArea: { connect: { id } } }));
const original = {
  id: SUBJECT_ID,
  name: "English",
  description: null,
  hourlyRate: new Prisma.Decimal("100.00"),
  format: "ONLINE",
  learningAreas: [{ learningArea: MATHEMATICS }],
};

beforeEach(() => {
  jest.clearAllMocks();
  findUser.mockResolvedValue({ tutorId: TUTOR_ID });
  findSubjects.mockResolvedValue([original]);
  findSubject.mockResolvedValue(original);
  create.mockResolvedValue({
    id: SUBJECT_ID,
    ...offering,
    hourlyRate: new Prisma.Decimal(input.hourlyRate),
    learningAreas: areaRows,
  });
  update.mockResolvedValue({
    id: SUBJECT_ID,
    ...offering,
    hourlyRate: new Prisma.Decimal(input.hourlyRate),
    learningAreas: areaRows,
  });
  countLearningAreas.mockImplementation(async (args) => {
    const ids = (args as { where: { id: { in: string[] } } }).where.id.in;
    return ids.filter((id) => AREA_IDS.includes(id)).length;
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
    expect(result.body.subjects).toEqual([
      { ...original, hourlyRate: "100.00", learningAreas: [MATHEMATICS] },
    ]);
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
        data: { ...offering, tutorId: TUTOR_ID, learningAreas: { create: areaLinks } },
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
    { learningAreaIds: [] },
    { learningAreaIds: undefined },
    { learningAreaIds: ["not-a-uuid"] },
    { learningAreaIds: [MATHEMATICS.id, MATHEMATICS.id] },
    {
      learningAreaIds: [
        MATHEMATICS.id,
        PHYSICS.id,
        "11000000-0000-4000-8000-000000000006",
        "11000000-0000-4000-8000-000000000007",
      ],
    },
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
    expect(result.body.subject).toEqual({
      id: SUBJECT_ID,
      ...offering,
      learningAreas: [MATHEMATICS, PHYSICS],
    });
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
      expect.objectContaining({
        where: { id: SUBJECT_ID, tutorId: TUTOR_ID },
        data: { ...offering, learningAreas: { deleteMany: {}, create: areaLinks } },
      })
    );
    expect(captureBookings.mock.invocationCallOrder[0]).toBeLessThan(
      update.mock.invocationCallOrder[0]
    );
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("returns learning areas with created offerings", async () => {
    const result = await auth(request(app).post(base).send(input)).expect(201);
    expect(result.body.subject.learningAreas).toEqual([MATHEMATICS, PHYSICS]);
  });

  it("caps a subject at three learning areas before checking the list", async () => {
    countLearningAreas.mockResolvedValue(4);
    const fourAreas = {
      ...input,
      learningAreaIds: [1, 2, 3, 4].map((n) => `11000000-0000-4000-8000-00000000010${n}`),
    };
    await auth(request(app).post(base).send(fourAreas)).expect(400);
    await auth(request(app).put(`${base}/${SUBJECT_ID}`).send(fourAreas)).expect(400);
    expect(countLearningAreas).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("rejects learning areas that are not in the list without writes", async () => {
    const unknown = { ...input, learningAreaIds: [MATHEMATICS.id, SUBJECT_ID] };
    const created = await auth(request(app).post(base).send(unknown)).expect(400);
    const updated = await auth(request(app).put(`${base}/${SUBJECT_ID}`).send(unknown)).expect(400);
    expect(created.body.message).toBe("Choose learning areas from the list");
    expect(updated.body.message).toBe("Choose learning areas from the list");
    expect(create).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(captureBookings).not.toHaveBeenCalled();
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
