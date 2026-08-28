import request from "supertest";
import { app } from "../src/apps.ts";

describe("GET /", () => {
    it("return 200 and get the message hi", async () => {
        const res = await request(app)
            .get("/")
            .expect(200)

        expect(res.body).toEqual({ message: "hi" });
    })
})