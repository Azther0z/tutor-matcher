import { apiRequest, readApi } from "@/src/lib/api-client";

const mockFetch = jest.fn();
global.fetch = mockFetch;

function response(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

beforeEach(() => {
  localStorage.clear();
  mockFetch.mockReset();
});

it("adds auth and serializes JSON without discarding caller headers", async () => {
  localStorage.setItem("authToken", "member-token");
  mockFetch.mockResolvedValue(response({ saved: true }));

  await readApi("/api/example", {
    auth: "required",
    method: "POST",
    headers: { "X-Request-Id": "request-1" },
    json: { name: "Tutor" },
  });

  const init = mockFetch.mock.calls[0]![1] as RequestInit;
  const headers = new Headers(init.headers);
  expect(headers.get("Authorization")).toBe("Bearer member-token");
  expect(headers.get("Content-Type")).toBe("application/json");
  expect(headers.get("X-Request-Id")).toBe("request-1");
  expect(init.body).toBe(JSON.stringify({ name: "Tutor" }));
});

it("clears an invalid optional token when requested", async () => {
  localStorage.setItem("authToken", "expired-token");
  mockFetch.mockResolvedValue(response({ message: "Expired" }, 401));

  await readApi("/api/example", { auth: "optional", clearOnUnauthorized: true });

  expect(localStorage.getItem("authToken")).toBeNull();
});

it("lets callers preserve domain error types", async () => {
  mockFetch.mockResolvedValue(response({ code: "CONFLICT" }, 409));

  await expect(
    apiRequest("/api/example", {
      errorMessage: "Fallback",
      makeError: ({ body, response: failed }) =>
        Object.assign(new Error("Conflict"), { body, status: failed.status }),
    })
  ).rejects.toMatchObject({ message: "Conflict", status: 409, body: { code: "CONFLICT" } });
});

it("supports an endpoint-specific empty response contract", async () => {
  mockFetch.mockResolvedValue(response(null));

  await expect(
    apiRequest("/api/example", {
      emptyBody: () => ({ saved: false }),
      errorMessage: "Empty response",
    })
  ).resolves.toEqual({ saved: false });
});
