import { afterAll, afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import { randomUUID } from "node:crypto";
import { URL } from "node:url";
import request from "supertest";
import { app } from "../../app.ts";
import { prisma } from "../../lib/db.ts";
import { signAuthToken } from "../../lib/jwt.ts";
import { versionInclude } from "./profile.service.ts";

if (process.env.RUN_DATABASE_INTEGRATION === "true") {
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (
    database.hostname !== "127.0.0.1" ||
    database.port !== "55434" ||
    database.username !== "auth4" ||
    !["/auth4_test", "/auth4_pending_constraint_20261011"].includes(database.pathname)
  ) {
    throw new Error(
      "AUTH-4 integration tests require an authorized isolated auth4 test database on 127.0.0.1:55434"
    );
  }
}
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
function copySubmission(id: string, owner = userId) {
  return auth(request(app).post(`/api/profiles/me/tutor/submissions/${id}/copy`), owner);
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

  it("keeps pending content immutable while saving a separate draft and preserves cancelled history", async () => {
    const id = await submitInitial();
    await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send({ bio: "Mutation" })
      .expect(200);
    await auth(request(app).put("/api/profiles/me/tutor"))
      .send({ ...fields, bio: "Mutation", consentAccepted: true })
      .expect(409);
    const other = await auth(request(app).post("/api/profiles/me/tutor/withdraw"), adminId).expect(
      409
    );
    expect(other.status).toBe(409);
    const withdrawn = await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(409);
    expect(withdrawn.body.version).toMatchObject({ id, status: "CANCELLED" });
    const copied = await copySubmission(id).expect(200);
    await submitDraft(copied.body.version.id).expect(200);
    expect(copied.body.version.id).not.toBe(id);
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

  it.each(["direct", "draft"])(
    "retains all certificates through a bio-only %s edit and approval",
    async (flow) => {
      const initial = await approvedTutor();
      const certificateUrls = [fields.certificationUrl, "https://example.com/z-certificate"];
      await prisma.tutorProfileVersionCertification.create({
        data: { profileVersionId: initial.versionId, fileUrl: certificateUrls[1]! },
      });
      const editFields = { ...fields, bio: "Updated bio with unchanged certificates" };
      let edit;
      if (flow === "draft") {
        await auth(request(app).put("/api/profiles/me/tutor/draft")).send(editFields).expect(200);
        await auth(request(app).put("/api/profiles/me/tutor/draft")).send(editFields).expect(200);
        edit = await auth(request(app).post("/api/profiles/me/tutor/submit"))
          .send({ consentAccepted: true })
          .expect(200);
      } else {
        edit = await auth(request(app).put("/api/profiles/me"))
          .send({ tutor: editFields })
          .expect(200);
      }
      expect(edit.body.version.certificationUrls).toEqual(certificateUrls);
      expect(edit.body.tutor.certificationUrls).toEqual(certificateUrls);
      const queue = await auth(request(app).get("/api/admin/tutor-requests"), adminId).expect(200);
      const queued = queue.body.find((item: { id: string }) => item.id === edit.body.version.id);
      expect(queued.certificationUrls).toEqual(certificateUrls);
      expect(queued.currentProfile.certificationUrls).toEqual(certificateUrls);
      expect((await review(edit.body.version.id)).status).toBe(200);
      const approved = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
      expect(approved.body.tutor.certificationUrls).toEqual(certificateUrls);
      expect(approved.body.tutor.certificationUrl).toBe(fields.certificationUrl);
      expect(approved.body.tutor.bio).toBe(editFields.bio);
      expect(
        await prisma.tutorProfileVersionCertification.count({
          where: { profileVersionId: initial.versionId },
        })
      ).toBe(2);
    }
  );

  it("does not treat hidden extra certificates as a change in an unchanged submission", async () => {
    const initial = await approvedTutor();
    await prisma.tutorProfileVersionCertification.create({
      data: { profileVersionId: initial.versionId, fileUrl: "https://example.com/z-certificate" },
    });
    await auth(request(app).put("/api/profiles/me")).send({ tutor: fields }).expect(400);
    await auth(request(app).put("/api/profiles/me/tutor/draft")).send(fields).expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(400);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "PENDING" } })).toBe(
      0
    );
  });

  it.each(["https://example.com/a-replacement", "https://example.com/zz-replacement"])(
    "retains other certificates when replacing with %s and resaving a draft",
    async (replacement) => {
      const initial = await approvedTutor();
      const retained = "https://example.com/z-certificate";
      await prisma.tutorProfileVersionCertification.create({
        data: { profileVersionId: initial.versionId, fileUrl: retained },
      });
      await auth(request(app).put("/api/profiles/me/tutor/draft"))
        .send({ certificationUrl: replacement })
        .expect(200);
      const draft = await auth(request(app).put("/api/profiles/me/tutor/draft"))
        .send({ ...fields, certificationUrl: replacement })
        .expect(200);
      expect(draft.body.version.certificationUrls).toEqual([replacement, retained].sort());
      const partial = await auth(request(app).put("/api/profiles/me/tutor/draft"))
        .send({ bio: "Changed without certificate fields" })
        .expect(200);
      expect(partial.body.version.certificationUrls).toEqual([replacement, retained].sort());
      expect(partial.body.tutor.certificationUrls).toEqual([fields.certificationUrl, retained]);
    }
  );

  it("uses the complete certificate snapshot for idempotent draft replacement and clearing", async () => {
    const initial = await approvedTutor();
    const retained = "https://example.com/z-certificate";
    const replacement = "https://example.com/zz-replacement";
    await prisma.tutorProfileVersionCertification.create({
      data: { profileVersionId: initial.versionId, fileUrl: retained },
    });
    const input = {
      ...fields,
      certificationUrl: replacement,
      certificationUrls: [replacement, retained],
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const saved = await auth(request(app).put("/api/profiles/me/tutor/draft"))
        .send(input)
        .expect(200);
      expect(saved.body.version.certificationUrls).toEqual([retained, replacement]);
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      const cleared = await auth(request(app).put("/api/profiles/me/tutor/draft"))
        .send({ certificationUrl: null, certificationUrls: [replacement] })
        .expect(200);
      expect(cleared.body.version.certificationUrls).toEqual([replacement]);
    }
    await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send({ certificationUrls: ["javascript:alert(1)"] })
      .expect(400);
    const unchanged = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(unchanged.body.version.certificationUrls).toEqual([replacement]);
  });

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

  it("shows an approved bio and intro video edit on the public profile and keeps it through a rejected edit", async () => {
    const initial = await approvedTutor();
    const publicProfile = async () =>
      (await auth(request(app).get(`/api/discovery/tutors/${initial.tutor.id}`)).expect(200)).body;
    const updated = {
      bio: "Updated public bio",
      introVideoUrl: "https://example.com/updated-intro",
    };
    const approvedEdit = await auth(request(app).put("/api/profiles/me"))
      .send({ tutor: { ...fields, ...updated } })
      .expect(200);
    expect(await publicProfile()).toMatchObject({
      bio: fields.bio,
      introVideoUrl: fields.introVideoUrl,
    });
    expect((await review(approvedEdit.body.version.id)).status).toBe(200);
    expect(await publicProfile()).toMatchObject(updated);

    const rejectedEdit = await auth(request(app).put("/api/profiles/me"))
      .send({
        tutor: {
          ...fields,
          bio: "Rejected public bio",
          introVideoUrl: "https://example.com/rejected-intro",
        },
      })
      .expect(200);
    expect(
      (await review(rejectedEdit.body.version.id, "REJECTED", "The video does not play")).status
    ).toBe(200);
    expect(await publicProfile()).toMatchObject(updated);
    const own = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(own.body).toMatchObject({
      tutor: updated,
      version: { status: "REJECTED", rejectionReason: "The video does not play" },
    });
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
      .send({ certificationUrl: null, introVideoUrl: null })
      .expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(400);
    await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send({ introVideoUrl: fields.introVideoUrl })
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
  async function createDraft(input: object = {}) {
    return auth(request(app).post("/api/profiles/me/tutor/drafts")).send(input).expect(200);
  }
  function saveDraft(id: string, input: object, owner = userId) {
    return auth(request(app).put(`/api/profiles/me/tutor/drafts/${id}`), owner).send(input);
  }
  function submitDraft(id: string) {
    return auth(request(app).post(`/api/profiles/me/tutor/drafts/${id}/submit`)).send({
      consentAccepted: true,
    });
  }
  function discardDraft(id: string, owner = userId) {
    return auth(request(app).delete(`/api/profiles/me/tutor/drafts/${id}`), owner);
  }

  it("creates independent drafts, edits the older selection, and discards only that draft with its certificates", async () => {
    const older = await createDraft({
      ...fields,
      certificationUrls: [fields.certificationUrl, "http://example.com/second"],
    });
    const newer = await createDraft({ bio: "Second draft" });
    const olderId = older.body.version.id;
    const newerId = newer.body.version.id;
    expect(newerId).not.toBe(olderId);
    expect(newer.body).toMatchObject({
      version: { id: newerId, identificationCardUrl: null, certificationUrls: [] },
      pendingRequest: null,
      latestReview: null,
    });
    expect(newer.body.drafts.map((draft: { id: string }) => draft.id)).toEqual([newerId, olderId]);
    expect(
      newer.body.drafts.every((draft: { createdAt?: string }) => Boolean(draft.createdAt))
    ).toBe(true);
    const saved = await saveDraft(olderId, {
      bio: "  Edited older draft  ",
      certificationUrls: ["https://example.com/replacement", "https://example.com/replacement"],
    }).expect(200);
    expect(saved.body.version).toMatchObject({
      id: olderId,
      bio: "Edited older draft",
      certificationUrls: ["https://example.com/replacement"],
    });
    expect(
      (await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id: olderId } })).bio
    ).toBe("Edited older draft");
    expect(saved.body.drafts.find((draft: { id: string }) => draft.id === newerId).bio).toBe(
      "Second draft"
    );
    const listed = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(listed.body.version.id).toBe(newerId);
    const discarded = await discardDraft(olderId).expect(200);
    expect(discarded.body.drafts.map((draft: { id: string }) => draft.id)).toEqual([newerId]);
    expect(await prisma.tutorProfileVersion.findUnique({ where: { id: olderId } })).toBeNull();
    expect(
      await prisma.tutorProfileVersionCertification.count({ where: { profileVersionId: olderId } })
    ).toBe(0);
    await discardDraft(olderId).expect(404);
  });

  it("creates multiple drafts concurrently while legacy upserts stay stable and reject ambiguous selection", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 4 }, (_, i) => createDraft({ bio: `Independent ${i}` }))
    );
    expect(new Set(attempts.map((res) => res.body.version.id)).size).toBe(4);
    await auth(request(app).put("/api/profiles/me/tutor/draft")).send(fields).expect(409);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(409);
    await auth(request(app).put("/api/profiles/me/tutor"))
      .send({ ...fields, consentAccepted: true })
      .expect(409);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "DRAFT" } })).toBe(4);
    const keep = attempts[0]!.body.version.id;
    for (const res of attempts.slice(1)) await discardDraft(res.body.version.id).expect(200);
    const legacy = await auth(request(app).put("/api/profiles/me/tutor/draft"))
      .send(fields)
      .expect(200);
    expect(legacy.body.version.id).toBe(keep);
    await auth(request(app).post("/api/profiles/me/tutor/submit"))
      .send({ consentAccepted: true })
      .expect(200);
  });

  it("isolates owner documents and blocks changes to pending and terminal versions", async () => {
    const draft = await createDraft(fields);
    const id = draft.body.version.id;
    await saveDraft(id, { bio: "Other owner" }, adminId).expect(404);
    await discardDraft(id, adminId).expect(404);
    await auth(request(app).post(`/api/profiles/me/tutor/drafts/${id}/submit`), adminId)
      .send({ consentAccepted: true })
      .expect(404);
    const other = await auth(request(app).get("/api/profiles/me/tutor"), adminId).expect(200);
    expect(other.body).toMatchObject({
      drafts: [],
      version: null,
      pendingRequest: null,
      latestSubmittedVersion: null,
    });
    await submitDraft(id).expect(200);
    await saveDraft(id, fields).expect(409);
    await discardDraft(id).expect(409);
    await submitDraft(id).expect(409);
    expect((await review(id, "REJECTED", "Incomplete evidence")).status).toBe(200);
    await saveDraft(id, fields).expect(409);
    await discardDraft(id).expect(409);
    await submitDraft(id).expect(409);
    const retried = await createDraft({ bio: "Retry" });
    expect(retried.body.version).toMatchObject({ ...fields, bio: "Retry", status: "DRAFT" });
    await submitDraft(retried.body.version.id).expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(200);
    await saveDraft(retried.body.version.id, fields).expect(409);
    await discardDraft(retried.body.version.id).expect(409);
    await submitDraft(retried.body.version.id).expect(409);
  });

  it("serializes submission of different selected drafts to one pending request and allows other draft mutations", async () => {
    const first = await createDraft({ ...fields, bio: "First" });
    const second = await createDraft({ ...fields, bio: "Second" });
    const ids = [first.body.version.id, second.body.version.id];
    const attempts = await Promise.all(ids.map(submitDraft));
    expect(attempts.map((res) => res.status).sort()).toEqual([200, 409]);
    const pendingId = attempts.find((res) => res.status === 200)!.body.version.id;
    const remainingId = ids.find((id) => id !== pendingId)!;
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "PENDING" } })).toBe(
      1
    );
    const saved = await saveDraft(remainingId, { bio: "Saved while pending" }).expect(200);
    expect(saved.body).toMatchObject({
      status: "PENDING",
      version: { id: remainingId, status: "DRAFT" },
      pendingRequest: { id: pendingId },
    });
    const third = await createDraft({ bio: "Third" });
    await discardDraft(third.body.version.id).expect(200);
    await submitDraft(remainingId).expect(409);
    const pending = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(pending.body.version.id).toBe(pendingId);
    expect(pending.body.pendingRequest.bio).not.toBe("Saved while pending");
    expect((await review(pendingId)).status).toBe(200);
    const after = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(after.body).toMatchObject({
      status: "APPROVED",
      pendingRequest: null,
      latestReview: { id: pendingId, status: "APPROVED" },
    });
    expect(after.body.drafts).toHaveLength(1);
    expect(after.body.drafts[0]).toMatchObject({ id: remainingId, bio: "Saved while pending" });
  });

  it("clones the approved profile instead of unreviewed drafts and preserves publication during review", async () => {
    const initial = await approvedTutor();
    await auth(request(app).patch("/api/profiles/me/tutor/publication"))
      .send({ published: true })
      .expect(200);
    const unreviewed = await createDraft({
      bio: "Unreviewed bio",
      certificationUrls: ["https://example.com/unreviewed"],
    });
    const selected = await createDraft({ bio: "New reviewed bio" });
    expect(selected.body.version).toMatchObject({
      ...fields,
      bio: "New reviewed bio",
      certificationUrls: [fields.certificationUrl],
    });
    await submitDraft(selected.body.version.id).expect(200);
    const whilePending = await createDraft({});
    expect(whilePending.body.version).toMatchObject({ ...fields, status: "DRAFT" });
    const saved = await saveDraft(unreviewed.body.version.id, { bio: "Still unreviewed" }).expect(
      200
    );
    expect(saved.body).toMatchObject({
      status: "APPROVED",
      tutor: { status: "PUBLISHED", bio: fields.bio },
      pendingRequest: { id: selected.body.version.id },
    });
    await auth(request(app).put("/api/profiles/me"))
      .send({ tutor: { ...fields, bio: "Ambiguous" } })
      .expect(409);
    expect((await review(selected.body.version.id)).status).toBe(200);
    const current = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(current.body.tutor).toMatchObject({ status: "PUBLISHED", bio: "New reviewed bio" });
    expect(
      current.body.drafts.find((draft: { id: string }) => draft.id === unreviewed.body.version.id)
    ).toMatchObject({
      bio: "Still unreviewed",
      certificationUrls: ["https://example.com/unreviewed"],
    });
    expect(
      current.body.drafts.find((draft: { id: string }) => draft.id === whilePending.body.version.id)
        .bio
    ).toBe(fields.bio);
    expect(
      (await prisma.tutor.findUniqueOrThrow({ where: { id: initial.tutor.id } }))
        .currentProfileVersionId
    ).toBe(selected.body.version.id);
    await saveDraft(selected.body.version.id, fields).expect(409);
    await discardDraft(selected.body.version.id).expect(409);
  });

  it("saves incomplete drafts, requires fresh consent, and persists normalized canonical arrays", async () => {
    const draft = await createDraft({ certificationUrls: [] });
    const id = draft.body.version.id;
    await submitDraft(id).expect(400);
    const modern = { ...fields, certificationUrl: undefined };
    await saveDraft(id, { ...modern, introVideoUrl: null, certificationUrls: [] }).expect(200);
    await submitDraft(id).expect(400);
    for (const url of ["", "not a url", "javascript:alert(1)", "ftp://example.com/cert"]) {
      await saveDraft(id, { certificationUrls: [url] }).expect(400);
    }
    expect(
      await prisma.tutorProfileVersionCertification.count({ where: { profileVersionId: id } })
    ).toBe(0);
    await saveDraft(id, {
      bio: "   ",
      certificationUrls: ["http://example.com/a", "https://example.com/b", "http://example.com/a"],
    }).expect(200);
    await submitDraft(id).expect(400);
    await saveDraft(id, { bio: "  Normalized bio  ", introVideoUrl: fields.introVideoUrl }).expect(
      200
    );
    await auth(request(app).post(`/api/profiles/me/tutor/drafts/${id}/submit`))
      .send({})
      .expect(400);
    const submitted = await submitDraft(id).expect(200);
    expect(submitted.body.version).toMatchObject({
      bio: "Normalized bio",
      certificationUrls: ["http://example.com/a", "https://example.com/b"],
    });
    expect((await review(id)).status).toBe(200);
    const tutor = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(tutor.body.tutor.certificationUrls).toEqual([
      "http://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("accepts array-only legacy submissions and rejects invalid arrays without altering the saved draft", async () => {
    const modern = { ...fields, certificationUrl: undefined };
    const draft = await createDraft({ ...modern, certificationUrls: [fields.certificationUrl] });
    await auth(request(app).put("/api/profiles/me/tutor"))
      .send({ ...modern, certificationUrls: ["javascript:alert(1)"], consentAccepted: true })
      .expect(400);
    expect(
      (await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id: draft.body.version.id } }))
        .status
    ).toBe("DRAFT");
    const submitted = await auth(request(app).put("/api/profiles/me/tutor"))
      .send({
        ...modern,
        certificationUrls: ["https://example.com/new", "https://example.com/new"],
        consentAccepted: true,
      })
      .expect(200);
    expect(submitted.body.version).toMatchObject({
      id: draft.body.version.id,
      certificationUrls: ["https://example.com/new"],
    });
    expect((await review(draft.body.version.id)).status).toBe(200);
    const edit = await auth(request(app).put("/api/profiles/me"))
      .send({
        tutor: { ...modern, bio: "Modern edit", certificationUrls: ["https://example.com/edit"] },
      })
      .expect(200);
    expect(edit.body.version.certificationUrls).toEqual(["https://example.com/edit"]);
    expect(edit.body.tutor.certificationUrls).toEqual(["https://example.com/new"]);
  });
  it("validates every persisted legacy certificate on submit and approval", async () => {
    const draft = await createDraft(fields);
    const id = draft.body.version.id;
    await prisma.tutorProfileVersionCertification.create({
      data: { profileVersionId: id, fileUrl: "javascript:alert(1)" },
    });
    await submitDraft(id).expect(400);
    expect((await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id } })).status).toBe(
      "DRAFT"
    );
    await prisma.tutorProfileVersion.update({ where: { id }, data: { status: "PENDING" } });
    expect((await review(id)).status).toBe(400);
    expect((await review(id, "REJECTED", "Unsafe document URL")).status).toBe(200);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).tutorId).toBeNull();
  });

  it("keeps remaining drafts and the current profile unchanged after rejecting a selected edit", async () => {
    const initial = await approvedTutor();
    const older = await createDraft({ bio: "Rejected selected edit" });
    const newer = await createDraft({
      bio: "Keep this draft",
      certificationUrls: ["https://example.com/keep"],
    });
    await submitDraft(older.body.version.id).expect(200);
    expect((await review(older.body.version.id, "REJECTED", "Unsupported claim")).status).toBe(200);
    const application = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(application.body).toMatchObject({
      status: "APPROVED",
      pendingRequest: null,
      latestReview: {
        id: older.body.version.id,
        status: "REJECTED",
        rejectionReason: "Unsupported claim",
      },
      version: { id: newer.body.version.id, status: "DRAFT" },
      tutor: { bio: fields.bio, status: "UNPUBLISHED" },
    });
    expect(application.body.drafts).toHaveLength(1);
    expect(application.body.drafts[0]).toMatchObject({
      id: newer.body.version.id,
      bio: "Keep this draft",
      certificationUrls: ["https://example.com/keep"],
    });
    expect(
      (await prisma.tutor.findUniqueOrThrow({ where: { id: initial.tutor.id } }))
        .currentProfileVersionId
    ).toBe(initial.versionId);
  });
  it("retains a cancelled snapshot across reload and copies it only on explicit request", async () => {
    const saved = await createDraft({ bio: "Independent saved draft", certificationUrls: [] });
    const certificates = ["http://example.com/withdrawn-a", "https://example.com/withdrawn-b"];
    const selected = await createDraft({
      ...fields,
      bio: "Withdrawn applicant content",
      certificationUrls: certificates,
    });
    const selectedId = selected.body.version.id;
    await submitDraft(selectedId).expect(200);
    await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(200);
    const reloaded = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(reloaded.body).toMatchObject({
      tutor: null,
      pendingRequest: null,
      latestReview: null,
      drafts: [saved.body.version],
      submissions: [expect.objectContaining({ id: selectedId, status: "CANCELLED" })],
      latestSubmittedVersion: {
        id: selectedId,
        status: "CANCELLED",
        bio: "Withdrawn applicant content",
        identificationCardUrl: fields.identificationCardUrl,
        certificationUrls: certificates,
      },
    });
    const reseeded = await copySubmission(selectedId).expect(200);
    expect(reseeded.body.version).toMatchObject({
      ...fields,
      bio: "Withdrawn applicant content",
      certificationUrl: certificates[0],
      certificationUrls: certificates,
      status: "DRAFT",
      submittedAt: null,
      reviewedAt: null,
      reviewedById: null,
      rejectionReason: null,
    });
    expect(reseeded.body.version.id).not.toBe(selectedId);
    expect(reseeded.body.latestSubmittedVersion).toMatchObject({
      id: selectedId,
      status: "CANCELLED",
      certificationUrls: certificates,
    });
    expect(
      reseeded.body.drafts.find((draft: { id: string }) => draft.id === saved.body.version.id)
    ).toMatchObject({ bio: "Independent saved draft", certificationUrls: [] });
    const withdrawn = await prisma.tutorProfileVersion.findUniqueOrThrow({
      where: { id: selectedId },
      include: { certifications: true },
    });
    expect(withdrawn).toMatchObject({ status: "CANCELLED", bio: "Withdrawn applicant content" });
    expect(withdrawn.certifications.map((certificate) => certificate.fileUrl).sort()).toEqual(
      certificates
    );
  });

  it("lists submitted history for owners and admins while keeping drafts private and copy ownership enforced", async () => {
    const approved = await approvedTutor();
    const rejected = await createDraft({ ...fields, bio: "Rejected edit" });
    await submitDraft(rejected.body.version.id).expect(200);
    expect((await review(rejected.body.version.id, "REJECTED", "Please clarify")).status).toBe(200);
    const cancelled = await createDraft({ ...fields, bio: "Cancelled edit" });
    await submitDraft(cancelled.body.version.id).expect(200);
    await copySubmission(cancelled.body.version.id).expect(409);
    await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(200);
    const pending = await createDraft({ ...fields, bio: "Pending edit" });
    await submitDraft(pending.body.version.id).expect(200);
    const privateDraft = await createDraft({ bio: "Private unsent draft" });
    const own = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(
      own.body.submissions.map((version: { status: string }) => version.status).sort()
    ).toEqual(["APPROVED", "CANCELLED", "PENDING", "REJECTED"]);
    const other = await auth(request(app).get("/api/profiles/me/tutor"), adminId).expect(200);
    expect(other.body.submissions).toEqual([]);
    const admin = await auth(request(app).get("/api/admin/tutor-requests"), adminId).expect(200);
    const userHistory = admin.body.filter(
      (version: { userId: string }) => version.userId === userId
    );
    expect(userHistory.map((version: { status: string }) => version.status).sort()).toEqual([
      "APPROVED",
      "CANCELLED",
      "PENDING",
      "REJECTED",
    ]);
    expect(
      admin.body.some((version: { id: string }) => version.id === privateDraft.body.version.id)
    ).toBe(false);
    await copySubmission(cancelled.body.version.id, adminId).expect(404);
    await copySubmission(approved.versionId).expect(409);
    await copySubmission(rejected.body.version.id).expect(409);
    await copySubmission(privateDraft.body.version.id).expect(409);
    await copySubmission("invalid-id").expect(400);
    const copied = await copySubmission(cancelled.body.version.id).expect(200);
    expect(copied.body.version).toMatchObject({
      status: "DRAFT",
      bio: "Cancelled edit",
      submittedAt: null,
      reviewedAt: null,
    });
    expect(copied.body.version.id).not.toBe(cancelled.body.version.id);
    expect(copied.body.pendingRequest.id).toBe(pending.body.version.id);
    expect(copied.body.tutor.id).toBe(approved.tutor.id);
  });

  it("ignores injected ownership and review fields when creating and saving a draft", async () => {
    const injected = {
      id: randomUUID(),
      userId: adminId,
      status: "APPROVED",
      submittedAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedById: adminId,
      rejectionReason: "Injected",
      certifications: { create: [{ fileUrl: "javascript:alert(1)" }] },
    };
    const created = await createDraft({ ...fields, ...injected });
    const id = created.body.version.id;
    expect(id).not.toBe(injected.id);
    expect(created.body.version).toMatchObject({
      userId,
      status: "DRAFT",
      submittedAt: null,
      reviewedAt: null,
      reviewedById: null,
      rejectionReason: null,
      certificationUrls: [fields.certificationUrl],
    });
    const saved = await saveDraft(id, {
      ...injected,
      bio: "Safe owner edit",
      certificationUrls: [],
    }).expect(200);
    expect(saved.body.version).toMatchObject({
      id,
      userId,
      status: "DRAFT",
      bio: "Safe owner edit",
      submittedAt: null,
      reviewedAt: null,
      reviewedById: null,
      rejectionReason: null,
      certificationUrls: [],
    });
    expect(await prisma.tutorProfileVersion.count({ where: { userId: adminId } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).tutorId).toBeNull();
  });
  it.each(["absent", "empty"])(
    "accepts %s certifications on initial enrollment and direct profile edits",
    async (mode) => {
      const modern = { ...fields, certificationUrl: undefined };
      const certificates = mode === "empty" ? { certificationUrls: [] } : {};
      const initial = await auth(request(app).put("/api/profiles/me/tutor"))
        .send({ ...modern, ...certificates, consentAccepted: true })
        .expect(200);
      expect(initial.body.version.certificationUrls).toEqual([]);
      expect(initial.body.version.certificationUrl).toBeNull();
      expect((await review(initial.body.version.id)).status).toBe(200);
      const edited = await auth(request(app).put("/api/profiles/me"))
        .send({ tutor: { ...modern, ...certificates, bio: "Updated without certifications" } })
        .expect(200);
      expect(edited.body.version).toMatchObject({ status: "PENDING", certificationUrls: [] });
      expect((await review(edited.body.version.id)).status).toBe(200);
      const current = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
      expect(current.body.tutor).toMatchObject({
        bio: "Updated without certifications",
        certificationUrls: [],
      });
    }
  );

  it("submits certificate-free drafts and approves clearing an existing certificate collection", async () => {
    const modern = { ...fields, certificationUrl: undefined };
    const initial = await createDraft({ ...modern, certificationUrls: [] });
    const submitted = await submitDraft(initial.body.version.id).expect(200);
    expect(submitted.body.version.certificationUrls).toEqual([]);
    expect((await review(initial.body.version.id)).status).toBe(200);
    const withCertificates = await createDraft({ certificationUrls: [fields.certificationUrl] });
    await submitDraft(withCertificates.body.version.id).expect(200);
    expect((await review(withCertificates.body.version.id)).status).toBe(200);
    const cleared = await createDraft({ certificationUrls: [] });
    const clearedSubmission = await submitDraft(cleared.body.version.id).expect(200);
    expect(clearedSubmission.body.version.certificationUrls).toEqual([]);
    expect(clearedSubmission.body.tutor.certificationUrls).toEqual([fields.certificationUrl]);
    expect((await review(cleared.body.version.id)).status).toBe(200);
    const current = await auth(request(app).get("/api/profiles/me/tutor")).expect(200);
    expect(current.body.tutor.certificationUrls).toEqual([]);
    expect(
      await prisma.tutorProfileVersionCertification.count({
        where: { profileVersionId: withCertificates.body.version.id },
      })
    ).toBe(1);
  });
  it("enforces the database pending limit for direct writes while allowing multiple drafts", async () => {
    const drafts = await Promise.all([
      prisma.tutorProfileVersion.create({ data: { userId, bio: "Direct draft one" } }),
      prisma.tutorProfileVersion.create({ data: { userId, bio: "Direct draft two" } }),
    ]);
    expect(new Set(drafts.map((draft) => draft.id)).size).toBe(2);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "DRAFT" } })).toBe(2);
    const pending = await prisma.tutorProfileVersion.create({
      data: { userId, status: "PENDING" },
    });
    await expect(
      prisma.tutorProfileVersion.create({ data: { userId, status: "PENDING" } })
    ).rejects.toMatchObject({ code: "P2002" });
    await expect(
      prisma.tutorProfileVersion.update({
        where: { id: drafts[0]!.id },
        data: { status: "PENDING" },
      })
    ).rejects.toMatchObject({ code: "P2002" });
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "PENDING" } })).toBe(
      1
    );
    await prisma.tutorProfileVersion.update({
      where: { id: pending.id },
      data: { status: "CANCELLED" },
    });
    const next = await prisma.tutorProfileVersion.create({ data: { userId, status: "PENDING" } });
    expect(next.id).not.toBe(pending.id);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "PENDING" } })).toBe(
      1
    );
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "DRAFT" } })).toBe(2);
  });
  it.each([
    { approved: false, certificates: [] },
    { approved: false, certificates: ["http://example.com/a", "https://example.com/b"] },
    { approved: true, certificates: [] },
    { approved: true, certificates: ["http://example.com/a", "https://example.com/b"] },
  ])(
    "cancellation retains history and explicit copying preserves the exact snapshot (%j)",
    async ({ approved, certificates }) => {
      const initial = approved ? await approvedTutor() : null;
      if (initial)
        await prisma.tutor.update({
          where: { id: initial.tutor.id },
          data: { status: "PUBLISHED" },
        });
      const remaining = await createDraft({
        bio: "Keep unchanged",
        certificationUrls: ["https://example.com/remaining"],
      });
      const selected = await createDraft({
        ...fields,
        avatarUrl: null,
        bio: "Return this exact snapshot",
        certificationUrls: certificates,
      });
      await submitDraft(selected.body.version.id).expect(200);
      const before = await prisma.tutorProfileVersion.findUniqueOrThrow({
        where: { id: selected.body.version.id },
        include: versionInclude,
      });
      const withdrawn = await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(
        200
      );
      expect(withdrawn.body.drafts).toEqual([remaining.body.version]);
      expect(withdrawn.body.submissions).toContainEqual(
        expect.objectContaining({ id: before.id, status: "CANCELLED" })
      );
      const copied = await copySubmission(before.id).expect(200);
      const restored = copied.body.version;
      expect(restored).toMatchObject({
        userId,
        status: "DRAFT",
        avatarUrl: null,
        bio: before.bio,
        introVideoUrl: before.introVideoUrl,
        identificationCardUrl: before.identificationCardUrl,
        certificationUrls: certificates,
        submittedAt: null,
        reviewedAt: null,
        reviewedById: null,
        rejectionReason: null,
      });
      expect(restored.id).not.toBe(before.id);
      expect(new Date(restored.createdAt).getTime()).toBeGreaterThan(before.createdAt.getTime());
      expect(withdrawn.body).toMatchObject({
        status: approved ? "APPROVED" : "CANCELLED",
        pendingRequest: null,
      });
      expect(copied.body.drafts).toHaveLength(2);
      expect(
        withdrawn.body.drafts.find(
          (draft: { id: string }) => draft.id === remaining.body.version.id
        )
      ).toEqual(remaining.body.version);
      expect(
        await prisma.tutorProfileVersion.findUniqueOrThrow({
          where: { id: before.id },
          include: versionInclude,
        })
      ).toEqual({ ...before, status: "CANCELLED" });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(user.tutorId).toBe(initial?.tutor.id ?? null);
      if (initial) {
        expect(withdrawn.body.tutor).toMatchObject({ status: "PUBLISHED", bio: fields.bio });
        expect(
          await prisma.tutor.findUniqueOrThrow({ where: { id: initial.tutor.id } })
        ).toMatchObject({ currentProfileVersionId: initial.versionId, status: "PUBLISHED" });
      }
      await submitDraft(restored.id).expect(200);
    }
  );

  it("serializes duplicate withdrawals without creating any draft", async () => {
    const id = await submitInitial();
    const attempts = await Promise.all(
      Array.from({ length: 3 }, () => auth(request(app).post("/api/profiles/me/tutor/withdraw")))
    );
    expect(attempts.map((response) => response.status).sort()).toEqual([200, 409, 409]);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "DRAFT" } })).toBe(0);
    expect(await prisma.tutorProfileVersion.count({ where: { userId, status: "PENDING" } })).toBe(
      0
    );
    expect((await prisma.tutorProfileVersion.findUniqueOrThrow({ where: { id } })).status).toBe(
      "CANCELLED"
    );
    await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(409);
    expect(await prisma.tutorProfileVersion.count({ where: { userId } })).toBe(1);
  });
  it.each([
    { certificates: [] },
    {
      certificates: [
        "http://example.com/approved-contest-a",
        "https://example.com/approved-contest-b",
      ],
    },
  ])(
    "publishes only approved portfolio evidence on existing tutor and subject endpoints (%j)",
    async ({ certificates }) => {
      const initial = await createDraft({ ...fields, certificationUrls: certificates });
      await submitDraft(initial.body.version.id).expect(200);
      expect((await review(initial.body.version.id)).status).toBe(200);
      const tutor = (
        await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { tutor: true } })
      ).tutor!;
      const subject = await prisma.subject.create({
        data: {
          tutorId: tutor.id,
          name: "Portfolio visibility",
          hourlyRate: "100.00",
        },
      });
      async function assertPublic(expected: string[]) {
        const discovery = await auth(
          request(app).get(`/api/discovery/tutors/${tutor.id}`),
          adminId
        ).expect(200);
        const availability = await auth(
          request(app).get(`/api/bookings/subjects/${subject.id}/availability`),
          adminId
        ).expect(200);
        expect(discovery.body.certificationUrls).toEqual(expected);
        expect(availability.body.subject.tutor.certificationUrls).toEqual(expected);
        for (const publicTutor of [discovery.body, availability.body.subject.tutor]) {
          for (const privateKey of [
            "identificationCardUrl",
            "certifications",
            "currentProfileVersion",
            "currentProfileVersionId",
            "submittedAt",
            "reviewedAt",
            "reviewedById",
            "rejectionReason",
            "drafts",
            "pendingRequest",
          ]) {
            expect(publicTutor).not.toHaveProperty(privateKey);
          }
          expect(JSON.stringify(publicTutor)).not.toContain(fields.identificationCardUrl);
        }
        return availability.body;
      }
      try {
        expect(await assertPublic(certificates)).toMatchObject({
          acceptingBookings: false,
          slots: [],
        });
        await auth(request(app).patch("/api/profiles/me/tutor/publication"))
          .send({ published: true })
          .expect(200);
        expect(await assertPublic(certificates)).toMatchObject({ acceptingBookings: true });
        const draft = await createDraft({
          bio: "Not public yet",
          certificationUrls: ["https://example.com/draft-only"],
        });
        await assertPublic(certificates);
        await submitDraft(draft.body.version.id).expect(200);
        await assertPublic(certificates);
        expect(
          (await review(draft.body.version.id, "REJECTED", "Unverified portfolio evidence")).status
        ).toBe(200);
        await assertPublic(certificates);
        const pending = await createDraft({
          bio: "Withdraw this portfolio",
          certificationUrls: ["https://example.com/cancelled-only"],
        });
        await submitDraft(pending.body.version.id).expect(200);
        await auth(request(app).post("/api/profiles/me/tutor/withdraw")).expect(200);
        await assertPublic(certificates);
        const cleared = await createDraft({
          bio: "Approved empty portfolio",
          certificationUrls: [],
        });
        await submitDraft(cleared.body.version.id).expect(200);
        await assertPublic(certificates);
        expect((await review(cleared.body.version.id)).status).toBe(200);
        await assertPublic([]);
      } finally {
        await prisma.subject.delete({ where: { id: subject.id } });
      }
    }
  );
});
