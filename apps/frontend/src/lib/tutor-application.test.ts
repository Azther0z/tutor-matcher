import { TutorApiError, tutorApi } from "./tutor-application";
import { jsonResponse } from "@/src/test/tutor-profile-fixtures";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  localStorage.clear();
  localStorage.setItem("authToken", "session-token");
});

it("keeps a refused request's details private behind a permission message", async () => {
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Administrator access required" }, 403));

  await expect(tutorApi("/api/admin/users")).rejects.toEqual(
    new TutorApiError("You do not have permission to perform this action.", 403)
  );
});

it("tells a suspended or banned account why its request was refused", async () => {
  fetchMock.mockResolvedValueOnce(
    jsonResponse(
      { code: "ACCOUNT_RESTRICTED", message: "This account has been banned. Reason: Fraud" },
      403
    )
  );

  const failure = tutorApi("/api/profiles/me/tutor");

  await expect(failure).rejects.toThrow("This account has been banned. Reason: Fraud");
  await expect(failure).rejects.toHaveProperty("status", 403);
});
