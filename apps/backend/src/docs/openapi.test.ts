import { describe, expect, it } from "@jest/globals";
import request from "supertest";
import { app } from "../app.ts";
import { openApiDocument } from "./openapi.ts";

type Operation = {
  tags: string[];
  summary: string;
  parameters?: Array<{ name: string; in: string; required: boolean }>;
  responses: Record<string, unknown>;
};

const operations = Object.entries(openApiDocument.paths).flatMap(([path, methods]) =>
  Object.entries(methods).map(([method, operation]) => ({
    path,
    method,
    operation: operation as unknown as Operation,
  }))
);

describe("OpenAPI document", () => {
  it("documents the API as OpenAPI 3.1 under /api", () => {
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(openApiDocument.servers).toEqual([{ url: "/api", description: "This server" }]);
    expect(operations.length).toBeGreaterThan(80);
  });

  it("gives every operation a tag from the tag list, a summary and a response", () => {
    const tagNames = openApiDocument.tags.map((tag) => tag.name);
    for (const { path, method, operation } of operations) {
      expect({ path, method, tagKnown: tagNames.includes(operation.tags[0]!) }).toEqual({
        path,
        method,
        tagKnown: true,
      });
      expect(operation.summary).toBeTruthy();
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
    }
  });

  it("declares a path parameter for every {placeholder} in a path", () => {
    for (const { path, operation } of operations) {
      const placeholders = [...path.matchAll(/\{(\w+)\}/g)].map((match) => match[1]);
      const declared = (operation.parameters ?? [])
        .filter((parameter) => parameter.in === "path")
        .map((parameter) => parameter.name);
      expect({ path, declared: declared.sort() }).toEqual({ path, declared: placeholders.sort() });
    }
  });

  it("builds request bodies from the server's own validation schemas", () => {
    const save = openApiDocument.paths["/payout-accounts"].post as unknown as {
      requestBody: { content: { "application/json": { schema: { required: string[] } } } };
    };
    expect(save.requestBody.content["application/json"].schema.required).toEqual(
      expect.arrayContaining(["bankCode", "accountHolderName", "accountNumber"])
    );
  });
});

describe("Swagger endpoints", () => {
  it("serves the raw document without authentication", async () => {
    const res = await request(app).get("/api/openapi.json").expect(200);
    expect(res.body.info.title).toBe("Tutor Matcher API");
  });

  it("serves the Swagger UI page at /api/docs without redirecting", async () => {
    // A redirect to /api/docs/ would loop behind the frontend proxy, which strips the slash.
    const res = await request(app).get("/api/docs").expect(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain('<base href="/api/docs/">');
    expect(res.text).toContain("swagger-ui");
  });

  it("serves the Swagger UI assets under /api/docs/", async () => {
    await request(app).get("/api/docs/swagger-ui-init.js").expect(200);
    await request(app).get("/api/docs/swagger-ui.css").expect(200);
  });
});
