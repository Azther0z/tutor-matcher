import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const findUnique = jest.fn<(args: unknown) => Promise<unknown>>();
const userUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const tutorCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const tutorUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const certificationCreate = jest.fn<(args: unknown) => Promise<unknown>>();
const certificationUpdate = jest.fn<(args: unknown) => Promise<unknown>>();
const transaction = jest.fn<(callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>>();

const tx = {
  user: { findUnique, update: userUpdate },
  tutor: { create: tutorCreate, update: tutorUpdate },
  certification: { create: certificationCreate, update: certificationUpdate },
};

jest.unstable_mockModule("../../lib/db.ts", () => ({
  // `tx` and the top-level client share the same mocks so a service can call
  // `prisma.user.findUnique` directly or inside `prisma.$transaction`.
  prisma: { $transaction: transaction, ...tx },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const profile = {
  user: { firstName: "Ada", lastName: "Lovelace", bio: "Mathematics tutor" },
  tutor: {
    avatarUrl: "https://example.com/avatar.jpg",
    bio: "I teach calculus.",
    introVideoUrl: "https://example.com/intro.mp4",
    governmentId: "ID-123",
    certificationUrl: "https://example.com/certification.pdf",
  },
};

// The `Tutor` table's own columns — certificationUrl lives in a separate
// `Certification` record, so it never appears in a tutor.create/update `data`.
const tutorFields = {
  avatarUrl: profile.tutor.avatarUrl,
  bio: profile.tutor.bio,
  introVideoUrl: profile.tutor.introVideoUrl,
  governmentId: profile.tutor.governmentId,
};

function tokenFor(userId: string) {
  return signAuthToken({ sub: userId, email: "tutor@example.com", isAdmin: false });
}

describe("PUT /api/profiles/me", () => {
  const tutorId = "88888888-8888-4888-8888-888888888888";
  const certificationId = "99999999-9999-4999-8999-999999999999";

  beforeEach(() => {
    findUnique.mockReset();
    userUpdate.mockReset();
    tutorCreate.mockReset();
    tutorUpdate.mockReset();
    certificationCreate.mockReset();
    certificationUpdate.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("requires authentication", async () => {
    await request(app).put("/api/profiles/me").send(profile).expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects invalid profile data", async () => {
    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor("11111111-1111-4111-8111-111111111111")}`)
      .send({ ...profile, tutor: { ...profile.tutor, governmentId: "" } })
      .expect(400);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing Tutor bio", async () => {
    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor("11111111-1111-4111-8111-111111111111")}`)
      .send({ ...profile, tutor: { ...profile.tutor, bio: "" } })
      .expect(400);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing certification document", async () => {
    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor("11111111-1111-4111-8111-111111111111")}`)
      .send({ ...profile, tutor: { ...profile.tutor, certificationUrl: "" } })
      .expect(400);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a Student with no linked Tutor record", async () => {
    findUnique.mockResolvedValue(null);

    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor("11111111-1111-4111-8111-111111111111")}`)
      .send(profile)
      .expect(403);

    expect(tutorCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it.each(["PENDING", "REJECTED"] as const)(
    "rejects an account whose Tutor application is still %s — a linked record is not an approved Tutor",
    async (status) => {
      findUnique.mockResolvedValue({ tutorId, tutor: { status, certifications: [] } });

      await request(app)
        .put("/api/profiles/me")
        .set("Authorization", `Bearer ${tokenFor("11111111-1111-4111-8111-111111111111")}`)
        .send(profile)
        .expect(403);

      expect(tutorUpdate).not.toHaveBeenCalled();
      expect(tutorCreate).not.toHaveBeenCalled();
    }
  );

  it.each(["PUBLISHED", "UNPUBLISHED"] as const)(
    "updates the listing and certification for an approved (%s) Tutor",
    async (status) => {
      findUnique.mockResolvedValue({
        tutorId,
        tutor: { status, certifications: [{ id: certificationId }] },
      });
      tutorUpdate.mockResolvedValue({ id: tutorId, ...tutorFields });
      userUpdate.mockResolvedValue({
        id: "11111111-1111-4111-8111-111111111111",
        email: "tutor@example.com",
        firstName: "Ada",
        lastName: "Lovelace",
        bio: "Mathematics tutor",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      certificationUpdate.mockResolvedValue({
        id: certificationId,
        fileUrl: profile.tutor.certificationUrl,
        tutorId,
      });

      const res = await request(app)
        .put("/api/profiles/me")
        .set("Authorization", `Bearer ${tokenFor("11111111-1111-4111-8111-111111111111")}`)
        .send(profile)
        .expect(200);

      expect(tutorUpdate).toHaveBeenCalledWith({ where: { id: tutorId }, data: tutorFields });
      expect(certificationUpdate).toHaveBeenCalledWith({
        where: { id: certificationId },
        data: { fileUrl: profile.tutor.certificationUrl },
      });
      expect(tutorCreate).not.toHaveBeenCalled();
      expect(certificationCreate).not.toHaveBeenCalled();
      expect(res.body.user).not.toHaveProperty("password");
      expect(res.body.tutor).toMatchObject(profile.tutor);
    }
  );

  it("creates the certification document the first time an approved Tutor submits one", async () => {
    findUnique.mockResolvedValue({
      tutorId,
      tutor: { status: "PUBLISHED", certifications: [] },
    });
    tutorUpdate.mockResolvedValue({ id: tutorId, ...tutorFields });
    userUpdate.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      email: "tutor@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      bio: "Mathematics tutor",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });
    certificationCreate.mockResolvedValue({
      id: certificationId,
      fileUrl: profile.tutor.certificationUrl,
      tutorId,
    });

    await request(app)
      .put("/api/profiles/me")
      .set("Authorization", `Bearer ${tokenFor("11111111-1111-4111-8111-111111111111")}`)
      .send(profile)
      .expect(200);

    expect(certificationCreate).toHaveBeenCalledWith({
      data: { fileUrl: profile.tutor.certificationUrl, tutorId },
    });
    expect(certificationUpdate).not.toHaveBeenCalled();
  });
});

describe("PUT /api/profiles/me/tutor", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const tutorId = "88888888-8888-4888-8888-888888888888";
  const certificationId = "99999999-9999-4999-8999-999999999999";

  const enrollmentInput = {
    ...profile.tutor,
    certificationUrl: "https://example.com/certification.pdf",
  };

  beforeEach(() => {
    findUnique.mockReset();
    userUpdate.mockReset();
    tutorCreate.mockReset();
    tutorUpdate.mockReset();
    certificationCreate.mockReset();
    certificationUpdate.mockReset();
    transaction.mockReset();
    transaction.mockImplementation(async (callback) => callback(tx));
  });

  it("requires authentication", async () => {
    await request(app).put("/api/profiles/me/tutor").send(enrollmentInput).expect(401);
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an application with a missing government ID", async () => {
    await request(app)
      .put("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send({ ...enrollmentInput, governmentId: "" })
      .expect(400);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an application with a missing certification document", async () => {
    await request(app)
      .put("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send({ ...enrollmentInput, certificationUrl: "" })
      .expect(400);

    expect(transaction).not.toHaveBeenCalled();
  });

  it("returns 404 when the account no longer exists", async () => {
    findUnique.mockResolvedValue(null);

    await request(app)
      .put("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send(enrollmentInput)
      .expect(404);

    expect(tutorCreate).not.toHaveBeenCalled();
  });

  it("creates a Tutor record and its certification for a first-time applicant", async () => {
    findUnique.mockResolvedValue({ tutorId: null, tutor: null });
    tutorCreate.mockResolvedValue({ id: tutorId, status: "PENDING", ...profile.tutor });
    userUpdate.mockResolvedValue({ id: userId });
    certificationCreate.mockResolvedValue({
      id: certificationId,
      fileUrl: enrollmentInput.certificationUrl,
      tutorId,
    });

    const res = await request(app)
      .put("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send(enrollmentInput)
      .expect(200);

    expect(tutorCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ ...tutorFields, status: "PENDING" }),
    });
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: userId },
      data: { tutor: { connect: { id: tutorId } } },
    });
    expect(certificationCreate).toHaveBeenCalledWith({
      data: { fileUrl: enrollmentInput.certificationUrl, tutorId },
    });
    expect(certificationUpdate).not.toHaveBeenCalled();
    expect(res.body.tutor).toMatchObject({
      ...profile.tutor,
      certificationUrl: enrollmentInput.certificationUrl,
    });
  });

  it("updates the existing Tutor record and certification on re-submission without re-linking", async () => {
    findUnique.mockResolvedValue({
      tutorId,
      tutor: { status: "REJECTED", certifications: [{ id: certificationId }] },
    });
    tutorUpdate.mockResolvedValue({ id: tutorId, status: "PENDING", ...profile.tutor });
    certificationUpdate.mockResolvedValue({
      id: certificationId,
      fileUrl: enrollmentInput.certificationUrl,
      tutorId,
    });

    await request(app)
      .put("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send(enrollmentInput)
      .expect(200);

    expect(tutorUpdate).toHaveBeenCalledWith({
      where: { id: tutorId },
      data: { ...tutorFields, status: "PENDING" },
    });
    expect(certificationUpdate).toHaveBeenCalledWith({
      where: { id: certificationId },
      data: { fileUrl: enrollmentInput.certificationUrl },
    });
    expect(tutorCreate).not.toHaveBeenCalled();
    expect(certificationCreate).not.toHaveBeenCalled();
    expect(userUpdate).not.toHaveBeenCalled();
  });

  it("returns 409 when the account is already an approved Tutor", async () => {
    findUnique.mockResolvedValue({ tutorId, tutor: { status: "PUBLISHED", certifications: [] } });

    await request(app)
      .put("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .send(enrollmentInput)
      .expect(409);

    expect(tutorUpdate).not.toHaveBeenCalled();
    expect(tutorCreate).not.toHaveBeenCalled();
    expect(certificationCreate).not.toHaveBeenCalled();
    expect(certificationUpdate).not.toHaveBeenCalled();
  });
});

describe("GET /api/profiles/me/tutor", () => {
  const userId = "11111111-1111-4111-8111-111111111111";
  const tutorRecord = {
    id: "88888888-8888-4888-8888-888888888888",
    avatarUrl: null,
    bio: "I teach calculus.",
    introVideoUrl: "https://example.com/intro.mp4",
    governmentId: "ID-123",
    status: "PENDING",
    enrolledAt: new Date("2026-01-01T00:00:00.000Z").toISOString(),
    certifications: [{ id: "99999999-9999-4999-8999-999999999999", fileUrl: "https://example.com/certification.pdf" }],
  };
  const tutorWithoutCertifications = {
    id: tutorRecord.id,
    avatarUrl: tutorRecord.avatarUrl,
    bio: tutorRecord.bio,
    introVideoUrl: tutorRecord.introVideoUrl,
    governmentId: tutorRecord.governmentId,
    status: tutorRecord.status,
    enrolledAt: tutorRecord.enrolledAt,
  };

  beforeEach(() => {
    findUnique.mockReset();
  });

  it("requires authentication", async () => {
    await request(app).get("/api/profiles/me/tutor").expect(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("reports NONE when the account has no Tutor record", async () => {
    findUnique.mockResolvedValue({ tutor: null });

    const res = await request(app)
      .get("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .expect(200);

    expect(res.body).toEqual({ status: "NONE", tutor: null });
  });

  it("reports PENDING with the submitted application, including the certification document", async () => {
    findUnique.mockResolvedValue({ tutor: tutorRecord });

    const res = await request(app)
      .get("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .expect(200);

    expect(res.body).toEqual({
      status: "PENDING",
      tutor: {
        ...tutorWithoutCertifications,
        certificationUrl: "https://example.com/certification.pdf",
      },
    });
  });

  it("reports a null certificationUrl when no certification has been submitted", async () => {
    findUnique.mockResolvedValue({ tutor: { ...tutorRecord, certifications: [] } });

    const res = await request(app)
      .get("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .expect(200);

    expect(res.body.tutor.certificationUrl).toBeNull();
  });

  it("collapses PUBLISHED and UNPUBLISHED to APPROVED", async () => {
    findUnique.mockResolvedValue({ tutor: { ...tutorRecord, status: "UNPUBLISHED" } });

    const res = await request(app)
      .get("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .expect(200);

    expect(res.body.status).toBe("APPROVED");
  });

  it("reports REJECTED so the applicant can re-submit", async () => {
    findUnique.mockResolvedValue({ tutor: { ...tutorRecord, status: "REJECTED" } });

    const res = await request(app)
      .get("/api/profiles/me/tutor")
      .set("Authorization", `Bearer ${tokenFor(userId)}`)
      .expect(200);

    expect(res.body.status).toBe("REJECTED");
  });
});
