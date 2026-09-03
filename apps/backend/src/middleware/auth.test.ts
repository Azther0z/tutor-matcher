import { describe, it, expect } from "@jest/globals";
import express from "express";
import request from "supertest";
import { requireAuth } from "./auth.ts";
import { signAuthToken } from "../lib/jwt.ts";

const app = express();
app.get("/protected", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

describe("requireAuth", () => {
  it("rejects a request with no Authorization header", async () => {
    await request(app).get("/protected").expect(401);
  });

  it("rejects a malformed Authorization header", async () => {
    await request(app).get("/protected").set("Authorization", "Token abc").expect(401);
  });

  it("rejects an invalid token", async () => {
    await request(app).get("/protected").set("Authorization", "Bearer not.a.jwt").expect(401);
  });

  it("passes a valid Bearer token through and populates req.user", async () => {
    const token = signAuthToken({ sub: 42, email: "ada@example.com", isAdmin: true });

    const res = await request(app)
      .get("/protected")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(res.body.user).toMatchObject({ sub: 42, email: "ada@example.com", isAdmin: true });
  });
});
