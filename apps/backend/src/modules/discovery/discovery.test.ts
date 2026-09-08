import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import request from "supertest";

const tutorFindUnique = jest.fn<(args: unknown) => Promise<unknown>>();

jest.unstable_mockModule("../../lib/db.ts", () => ({
  prisma: {
    tutor: { findUnique: tutorFindUnique },
  },
}));

const { app } = await import("../../app.ts");
const { signAuthToken } = await import("../../lib/jwt.ts");

function tokenFor(userId = 1) {
  return signAuthToken({ sub: userId, email: "student@example.com", isAdmin: false });
}

describe("Discovery API", () => {
  beforeEach(() => {
    tutorFindUnique.mockReset();
  });

  it("requires authentication", async () => {
    await request(app).get("/api/discovery/tutors/2").expect(401);
    expect(tutorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 for a non-numeric tutor id", async () => {
    await request(app)
      .get("/api/discovery/tutors/not-a-number")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(404);

    expect(tutorFindUnique).not.toHaveBeenCalled();
  });

  it("returns 404 when the tutor does not exist", async () => {
    tutorFindUnique.mockResolvedValue(null);

    await request(app)
      .get("/api/discovery/tutors/2")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(404);
  });

  it("returns the tutor's public identity", async () => {
    tutorFindUnique.mockResolvedValue({
      id: 2,
      user: { id: 20, firstName: "Anong", lastName: "P." },
    });

    const response = await request(app)
      .get("/api/discovery/tutors/2")
      .set("Authorization", `Bearer ${tokenFor()}`)
      .expect(200);

    expect(tutorFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 2 } }));
    expect(response.body).toEqual({
      id: 2,
      userId: 20,
      firstName: "Anong",
      lastName: "P.",
    });
  });
});
