import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import request from "supertest";
const findUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateUser = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findRequests = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const findRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const updateRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const createTutor = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const lockRows = jest.fn<(...args: unknown[]) => Promise<unknown>>();
const tx = {
  $queryRaw: lockRows,
  user: { findUnique: findUser, update: updateUser },
  tutor: { create: createTutor },
  tutorProfileVersion: { findMany: findRequests, findUnique: findRequest, update: updateRequest },
};
jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    ...tx,
    $transaction: async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx),
  },
}));
const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");
const { env } = await import("../../lib/env.ts");
const { EmailConfigurationError } = await import("../../lib/email.ts");
const auth = (isAdmin: boolean) =>
  `Bearer ${signAuthToken({ sub: "44444444-4444-4444-8444-444444444444", email: "admin@example.com", isAdmin })}`;
const originalEmailDeliveryMode = env.emailDeliveryMode;
beforeEach(() => {
  for (const mock of [
    findUser,
    updateUser,
    findRequests,
    findRequest,
    updateRequest,
    createTutor,
    lockRows,
  ]) {
    mock.mockReset();
  }
  Object.assign(env, { emailDeliveryMode: "log" });
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.assign(env, { emailDeliveryMode: originalEmailDeliveryMode });
});
describe("AUTH-4 admin authorization and validation", () => {
  it("requires authentication", async () => {
    await request(app).get("/api/admin/tutor-requests").expect(401);
  });
  it("rejects stale admin tokens after DB privilege removal", async () => {
    findUser.mockResolvedValue({ isAdmin: false });
    await request(app)
      .get("/api/admin/tutor-requests")
      .set("Authorization", auth(true))
      .expect(403);
    expect(findRequests).not.toHaveBeenCalled();
  });
  it("uses DB privileges when token predates promotion", async () => {
    findUser.mockResolvedValue({ isAdmin: true });
    findRequests.mockResolvedValue([]);
    await request(app)
      .get("/api/admin/tutor-requests")
      .set("Authorization", auth(false))
      .expect(200, []);
  });
  it("rejects malformed UUID", async () => {
    await request(app)
      .post("/api/admin/tutor-requests/not-a-uuid/review")
      .set("Authorization", auth(true))
      .send({ decision: "APPROVED" })
      .expect(400);
    expect(findUser).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "   "])(
    "requires a nonempty rejection reason (%s)",
    async (rejectionReason) => {
      await request(app)
        .post("/api/admin/tutor-requests/55555555-5555-4555-8555-555555555555/review")
        .set("Authorization", auth(true))
        .send({ decision: "REJECTED", rejectionReason })
        .expect(400);
      expect(findUser).not.toHaveBeenCalled();
    }
  );
});

const requestId = "55555555-5555-4555-8555-555555555555";
const applicantId = "66666666-6666-4666-8666-666666666666";
const applicant = { id: applicantId, email: "applicant@example.com", firstName: "Ada" };

function pendingRequest(overrides: Record<string, unknown> = {}) {
  return {
    id: requestId,
    userId: applicantId,
    avatarUrl: null,
    bio: "I teach calculus.",
    introVideoUrl: "https://example.com/intro.mp4",
    identificationCardUrl: "https://example.com/id.png",
    status: "PENDING",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    submittedAt: new Date("2026-10-02T00:00:00.000Z"),
    reviewedAt: null,
    reviewedById: null,
    rejectionReason: null,
    certifications: [{ fileUrl: "https://example.com/certificate.pdf" }],
    ...overrides,
  };
}

// Answers the reads a review makes: the admin check, the request's owner, the locked applicant,
// and the request re-read after the lock. Writes echo the saved request back.
function mockReview(version: ReturnType<typeof pendingRequest>) {
  findUser.mockImplementation(async (args) =>
    (args as { select?: { isAdmin?: boolean } }).select?.isAdmin
      ? { isAdmin: true }
      : { ...applicant, tutor: null }
  );
  findRequest.mockImplementation(async (args) =>
    (args as { select?: { userId?: boolean } }).select?.userId ? { userId: applicantId } : version
  );
  lockRows.mockResolvedValue([]);
  updateRequest.mockImplementation(async (args) => ({
    ...version,
    ...(args as { data: Record<string, unknown> }).data,
  }));
  createTutor.mockResolvedValue({ id: "77777777-7777-4777-8777-777777777777" });
  updateUser.mockResolvedValue({});
}

const review = (body: Record<string, unknown>) =>
  request(app)
    .post(`/api/admin/tutor-requests/${requestId}/review`)
    .set("Authorization", auth(true))
    .send(body);

describe("SAFE-2 unsupported verification documents", () => {
  it("lists the unsupported identity and certification files of each request", async () => {
    findUser.mockResolvedValue({ isAdmin: true });
    findRequests.mockResolvedValue([
      {
        ...pendingRequest({ identificationCardUrl: "https://example.com/id.docx" }),
        user: { ...applicant, lastName: "Lovelace", tutor: null },
      },
    ]);

    const res = await request(app)
      .get("/api/admin/tutor-requests")
      .set("Authorization", auth(true))
      .expect(200);

    expect(res.body[0].documentIssues).toEqual([
      { document: "identificationCard", url: "https://example.com/id.docx", extension: ".docx" },
    ]);
  });

  it.each([
    ["identification card", { identificationCardUrl: "https://example.com/id.docx" }, ".docx"],
    ["certification", { certifications: [{ fileUrl: "https://example.com/award.exe" }] }, ".exe"],
  ])(
    "blocks approval of an unsupported %s and keeps the request pending",
    async (label, overrides, extension) => {
      mockReview(pendingRequest(overrides));

      const res = await review({ decision: "APPROVED" }).expect(422);

      expect(res.body.message).toContain(`${label} (${extension})`);
      expect(res.body.documents).toEqual([expect.objectContaining({ extension })]);
      expect(updateRequest).not.toHaveBeenCalled();
      expect(createTutor).not.toHaveBeenCalled();
    }
  );

  it("approves supported and extension-less document URLs", async () => {
    mockReview(
      pendingRequest({
        identificationCardUrl: "https://example.com/id",
        certifications: [{ fileUrl: "https://example.com/Certificate.PDF?download=1" }],
      })
    );

    const res = await review({ decision: "APPROVED" }).expect(200);

    expect(res.body.status).toBe("APPROVED");
    expect(createTutor).toHaveBeenCalledWith({
      data: { currentProfileVersionId: requestId, status: "UNPUBLISHED" },
    });
  });

  it("still lets the admin reject a request with unsupported files", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    mockReview(pendingRequest({ identificationCardUrl: "https://example.com/id.docx" }));

    const res = await review({
      decision: "REJECTED",
      rejectionReason: "Upload your identification card as a PDF or image.",
    }).expect(200);

    expect(res.body.status).toBe("REJECTED");
  });
});

describe("SAFE-2 rejection email", () => {
  it("emails the trimmed rejection reason to the applicant", async () => {
    const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => undefined);
    mockReview(pendingRequest());

    const res = await review({
      decision: "REJECTED",
      rejectionReason: "  The identification card is blurry.  ",
    }).expect(200);

    expect(res.body).toMatchObject({
      status: "REJECTED",
      rejectionReason: "The identification card is blurry.",
    });
    expect(consoleInfo).toHaveBeenCalledWith(
      "[notification:tutor-request] applicant@example.com: request not approved. Reason: The identification card is blurry."
    );
  });

  it("does not email the applicant when a request is approved", async () => {
    const consoleInfo = jest.spyOn(console, "info").mockImplementation(() => undefined);
    mockReview(pendingRequest());

    await review({ decision: "APPROVED" }).expect(200);

    expect(consoleInfo).not.toHaveBeenCalled();
  });

  it("keeps the recorded rejection when the email cannot be sent", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
    Object.assign(env, { emailDeliveryMode: "smtp" });
    mockReview(pendingRequest());

    const res = await review({
      decision: "REJECTED",
      rejectionReason: "The identification card is blurry.",
    }).expect(200);

    expect(res.body.status).toBe("REJECTED");
    expect(updateRequest).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalledWith(expect.any(EmailConfigurationError));
  });
});
