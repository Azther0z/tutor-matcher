import { afterAll, afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";

const describeDatabase = process.env.RUN_DATABASE_INTEGRATION === "true" ? describe : describe.skip;
const fields = {
  avatarUrl: "https://example.com/avatar",
  bio: "I teach calculus.",
  introVideoUrl: "https://example.com/intro",
  identificationCardUrl: "https://example.com/id",
  certificationUrl: "https://example.com/certificate",
};
let userId: string;
let adminId: string;
function auth(test: request.Test, id = userId, isAdmin = false) {
  return test.set(
    "Authorization",
    `Bearer ${signAuthToken({ sub: id, email: "auth4-test@example.com", isAdmin })}`
  );
}
async function submitInitial() {
  const res = await auth(request(app).put("/api/profiles/me/tutor"))
    .send({ ...fields, consentAccepted: true })
    .expect(200);
  return res.body.version.id as string;
}
async function review(id: string, decision = "APPROVED", rejectionReason?: string) {
  return auth(request(app).post(`/api/admin/tutor-requests/${id}/review`), adminId).send({
    decision,
    rejectionReason,
  });
}
async function approvedTutor() {
  const id = await submitInitial();
  await (
    await review(id)
  ).body;
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: { tutor: true },
  });
  return { versionId: id, tutor: user.tutor! };
}

describeDatabase("AUTH-4 HTTP and PostgreSQL lifecycle", () => {
  beforeEach(async () => {
    userId = randomUUID();
    adminId = randomUUID();
    await prisma.user.createMany({
      data: [
        {
          id: userId,
          email: `auth4-${userId}@example.com`,
          password: "fixture",
          firstName: "Tutor",
          lastName: "Original",
        },
        {
          id: adminId,
          email: `auth4-${adminId}@example.com`,
          password: "fixture",
          firstName: "Admin",
          lastName: "Reviewer",
          isAdmin: true,
        },
      ],
    });
  });
  afterEach(async () => {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { tutorId: true } });
    if (user?.tutorId) {
      await prisma.user.update({ where: { id: userId }, data: { tutorId: null } });
      await prisma.tutor.delete({ where: { id: user.tutorId } });
    }
    await prisma.tutorProfileVersionCertification.deleteMany({
      where: { profileVersion: { userId } },
    });
    await prisma.tutorProfileVersion.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, adminId] } } });
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("keeps first application pending without a Tutor, then creates unpublished Tutor on approval", async () => {
    const id = await submitInitial();
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).tutorId).toBeNull();
    const pending = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(pending.body).toMatchObject({
      status: "PENDING",
      tutor: null,
      version: { ...fields, status: "PENDING" },
    });
    const result = await review(id);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ status: "APPROVED", reviewedById: adminId });
    const approved = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(approved.body).toMatchObject({
      status: "APPROVED",
      tutor: { ...fields, status: "UNPUBLISHED", verified: true },
    });
  });

  it("serializes concurrent submissions to exactly one pending request", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        auth(request(app).put("/api/profiles/me/tutor")).send({ ...fields, consentAccepted: true })
      )
    );
    expect(attempts.map((res) => res.status).sort()).toEqual([200, 409, 409, 409, 409]);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "PENDING" } })).toBe(
      1
    );
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).tutorId).toBeNull();
  });

  it("serializes concurrent draft saves into one editable draft", async () => {
    const responses = await Promise.all(
      Array.from({ length: 4 }, (_, index) =>
        auth(request(app).put("/api/profiles/me/tutor/draft")).send({ bio: `Draft ${index}` })
      )
    );
    expect(responses.every((res) => res.status === 200)).toBe(true);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "DRAFT" } })).toBe(1);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(400);
    await auth(request(app).put("/api/profiles/me/tutor/draft")).send(fields).expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: false })
      .expect(400);
    const submitted = await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(200);
    expect(submitted.body.version.status).toBe("PENDING");
  });

  it("makes submitted content immutable until withdrawal and preserves cancelled history", async () => {
    const id = await submitInitial();
    await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send({ bio: "Mutation" })
      .expect(409);
    await auth(request(app).put("/api/profiles/me/tutor"))
      .send({ ...fields, bio: "Mutation", consentAccepted: true })
      .expect(409);
    const other = await auth(request(app).post("/api/profiles/me/tutor/withdraw"), adminId).expect(
      409
    );
    expect(other.status).toBe(409);
    await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(409);
    const resubmitted = await submitInitial();
    expect(resubmitted).not.toBe(id);
    expect((await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id } })).status).toBe(
      "CANCELLED"
    );
    expect((await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id } })).bio).toBe(
      fields.bio
    );
  });

  it("requires rejection reason and supports a new application after rejection", async () => {
    const id = await submitInitial();
    expect((await review(id, "REJECTED", "   ")).status).toBe(400);
    expect((await review(id, "REJECTED", "  Credentials unclear  ")).status).toBe(200);
    const rejected = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(rejected.body).toMatchObject({
      status: "REJECTED",
      tutor: null,
      version: { rejectionReason: "Credentials unclear" },
    });
    const next = await submitInitial();
    expect(next).not.toBe(id);
  });

  it.each(["PUBLISHED", "UNPUBLISHED"] as const)(
    "keeps current %s profile during editing and switches only the pointer on approval",
    async (status) => {
      const initial = await approvedTutor();
      await prisma.tutor.update({ where: { id: initial.tutor.id }, data: { status } });
      const edit = await auth(request(app).put("/api/profiles/me"))
        .send({
          user: { firstName: "Must not change", lastName: "Must not change" },
          tutor: { ...fields, bio: "New approved bio" },
        })
        .expect(200);
      expect(edit.body).toMatchObject({
        status: "APPROVED",
        tutor: { bio: fields.bio, status },
        version: { bio: "New approved bio", status: "PENDING" },
      });
      const queue = await auth(request(app).get("/api/admin/tutor-requests"), adminId).expect(200);
      const item = queue.body.find((value: { id: string }) => value.id === edit.body.version.id);
      expect(item).toMatchObject({
        bio: "New approved bio",
        currentProfile: { bio: fields.bio },
        user: { id: userId },
      });
      expect(item.user).not.toHaveProperty("password");
      expect((await review(edit.body.version.id)).status).toBe(200);
      const tutor = await prisma.tutor.findUniqueOrThrow({ where: { id: initial.tutor.id } });
      expect(tutor).toMatchObject({
        status,
        currentProfileVersionId: edit.body.version.id,
        enrolledAt: initial.tutor.enrolledAt,
      });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user).toMatchObject({
        firstName: "Tutor",
        lastName: "Original",
        tutorId: initial.tutor.id,
      });
      const old = await prisma.tutorProfileVersion.findUniqueOrThrow({
        where: { id: initial.versionId },
      });
      expect(old).toMatchObject({ bio: fields.bio, status: "APPROVED" });
    }
  );

  it("rejected edits keep the current profile and publication setting", async () => {
    const initial = await approvedTutor();
    await auth(request(app).patch("/api/profiles/me/tutor/publication"))
      .send({ published: true })
      .expect(200);
    const edit = await auth(request(app).put("/api/profiles/me"))
      .send({ tutor: { ...fields, bio: "Rejected edit" } })
      .expect(200);
    expect((await review(edit.body.version.id, "REJECTED", "Unsupported claim")).status).toBe(200);
    const res = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(res.body).toMatchObject({
      status: "APPROVED",
      tutor: { status: "PUBLISHED", bio: fields.bio },
      version: { status: "REJECTED" },
    });
    expect(
      (await prisma.tutor.findUniqueOrThrow({ where: { id: initial.tutor.id } }))
        .currentProfileVersionId
    ).toBe(initial.versionId);
  });

  it("serializes simultaneous reviews and creates exactly one Tutor", async () => {
    const id = await submitInitial();
    const responses = await Promise.all([review(id), review(id), review(id)]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409, 409]);
    expect(await prisma.tutor.count({ where: { currentProfileVersionId: id } })).toBe(1);
  });

  it("handles withdrawal racing approval without resurrecting cancelled requests", async () => {
    const id = await submitInitial();
    const responses = await Promise.all([
      review(id),
      auth(request(app).post("/api/profiles/me/tutor/withdraw")),
    ]);
    expect(responses.map((res) => res.status).sort()).toEqual([200, 409]);
    const version = await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id } });
    const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(Boolean(user.tutorId)).toBe(version.status === "APPROVED");
  });

  it("checks live DB admin privilege and returns 404 for unknown requests", async () => {
    const id = await submitInitial();
    await auth(request(app).post(`/api/admin/tutor-requests/${id}/review`), userId, true)
      .send({ decision: "APPROVED" })
      .expect(403);
    await auth(request(app).get("/api/admin/tutor-requests"), userId, true).expect(403);
    expect((await review(randomUUID())).status).toBe(404);
    expect((await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id } })).status).toBe(
      "PENDING"
    );
  });

  it("rejects approval of incomplete legacy pending data but allows rejection", async () => {
    const version = await prisma.tutorProfileVersion.create({
      data: { userId, status: "PENDING", bio: "Legacy" },
    });
    expect((await review(version.id)).status).toBe(400);
    expect(
      (await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id: version.id } })).status
    ).toBe("PENDING");
    expect((await review(version.id, "REJECTED", "Missing documents")).status).toBe(200);
  });

  it("rejects identical submissions but accepts a document-only change", async () => {
    await approvedTutor();
    await auth(request(app).put("/api/profiles/me")).send({ tutor: fields }).expect(400);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "PENDING" } })).toBe(
      0
    );
    const edit = await auth(request(app).put("/api/profiles/me"))
      .send({ tutor: { ...fields, identificationCardUrl: "https://example.com/new-id" } })
      .expect(200);
    expect(edit.body.version.identificationCardUrl).toBe("https://example.com/new-id");
    expect(edit.body.tutor.identificationCardUrl).toBe(fields.identificationCardUrl);
  });

  it("partial draft retains previous content, allows clearing fields and requires complete resubmission", async () => {
    await approvedTutor();
    const draft = await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send({ bio: "Draft edit" })
      .expect(200);
    expect(draft.body.version).toMatchObject({ ...fields, bio: "Draft edit", status: "DRAFT" });
    await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send({ certificationUrl: null })
      .expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(400);
    await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send({ certificationUrl: fields.certificationUrl })
      .expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(200);
  });

  it("preserves publication chosen while approval is pending", async () => {
    await approvedTutor();
    await auth(request(app).patch("/api/profiles/me/tutor/publication"))
      .send({ published: true })
      .expect(200);
    const edit = await auth(request(app).put("/api/profiles/me"))
      .send({ tutor: { ...fields, bio: "Updated" } })
      .expect(200);
    await auth(request(app).patch("/api/profiles/me/tutor/publication"))
      .send({ published: false })
      .expect(200);
    expect((await review(edit.body.version.id)).status).toBe(200);
    const res = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(res.body.tutor).toMatchObject({ status: "UNPUBLISHED", bio: "Updated" });
  });
});
