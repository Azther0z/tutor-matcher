import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const tutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    user: { findUnique: tutorFindUnique },
  },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

const TUTOR_ID = "00000000-0000-4000-8000-000000000002";
const USER_ID = "00000000-0000-4000-8000-000000000020";

function tokenFor(userId = USER_ID) {
  return signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false });
}

describe("Discovery API", () => {
  beforeEach(() => {
    tutorFindUnique.mockReset();
  });

  it("requires authentication", async () => {
    await request(app).get(`/api/discovery/tutors/${TUTOR_ID}`).expect(401);
    expect(tutorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for an invalid tutor id", async () => {
    await request(app)
      .get("/api/discovery/tutors/not-a-uuid")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(404);

    expect(tutorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the tutor does not exist", async () => {
    tutorFindUnique.mockResolvedValue(null);

    await request(app)
      .get(`/api/discovery/tutors/${TUTOR_ID}`)
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(404);
  });

  it("returns the tutor's public identity", async () => {
    tutorFindUnique.mockResolvedValue({
      id: USER_ID,
      firstName: "Anong",
      lastName: "P.",
      tutor: {
        id: TUTOR_ID,
        status: "PUBLISHED",
        currentProfileVersion: {
          status: "APPROVED",
          bio: "Approved bio",
          avatarUrl: null,
          introVideoUrl: null,
          identificationCardUrl: "https://example.com/private-id",
          certifications: [
            { fileUrl: "https://example.com/public-contest" },
            { fileUrl: "https://example.com/public-second-contest" },
          ],
        },
      },
    });

    const response = await request(app)
      .get(`/api/discovery/tutors/${TUTOR_ID}`)
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(200);

    expect(tutorFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tutorId: TUTOR_ID } })
    );
    expect(response.body).toEqual({
      id: TUTOR_ID,
      userId: USER_ID,
      firstName: "Anong",
      lastName: "P.",
      status: "PUBLISHED",
      verified: true,
      bio: "Approved bio",
      avatarUrl: null,
      introVideoUrl: null,
      certificationUrls: [
        "https://example.com/public-contest",
        "https://example.com/public-second-contest",
      ],
    });
    expect(JSON.stringify(response.body)).not.toContain("identificationCardUrl");
    expect(JSON.stringify(response.body)).not.toContain("private-");
  });
  it.each(["DRAFT", "PENDING", "REJECTED", "CANCELLED"])(
    "never exposes a %s portfolio even if the current pointer is malformed",
    async (status) => {
      tutorFindUnique.mockResolvedValue({
        id: USER_ID,
        firstName: "Anong",
        lastName: "P.",
        tutor: {
          id: TUTOR_ID,
          status: "UNPUBLISHED",
          currentProfileVersion: {
            status,
            bio: null,
            avatarUrl: null,
            introVideoUrl: null,
            certifications: [{ fileUrl: "https://example.com/not-approved" }],
          },
        },
      });
      const response = await request(app)
        .get(`/api/discovery/tutors/${TUTOR_ID}`)
        .set("Authorization", `Bearer ${tokenFor()}`)
        .expect(200);
      expect(response.body.certificationUrls).toEqual([]);
      expect(JSON.stringify(response.body)).not.toContain("not-approved");
      expect(response.body).not.toHaveProperty("currentProfileVersion");
    }
  );
});
