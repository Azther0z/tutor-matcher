import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/jest-globals";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import SettingsPage from "./page";

const fetchMock = jest.fn<typeof fetch>();

function response(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    json: async () => body,
  } as Response);
}

describe("student preference settings", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    window.localStorage.clear();
    window.localStorage.setItem("authToken", "test-token");
  });

  it("loads saved preferences into the form", async () => {
    fetchMock.mockReturnValue(
      response({
        profile: {
          subjects: ["Mathematics"],
          level: "Beginner",
          goals: "Prepare for exams",
          preferredWeekdays: [1],
          preferredStartMinute: 540,
          preferredEndMinute: 660,
          timezone: "UTC",
        },
      })
    );

    render(<SettingsPage />);

    await waitFor(() => expect(screen.getByDisplayValue("Mathematics")).toBeInTheDocument());
    expect(screen.getByDisplayValue("Prepare for exams")).toBeInTheDocument();
    expect(screen.getByDisplayValue("09:00")).toBeInTheDocument();
  });

  it("validates required fields before saving", async () => {
    fetchMock.mockReturnValue(response({ profile: null }));
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Add at least one subject");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("saves complete preferences", async () => {
    fetchMock
      .mockReturnValueOnce(response({ profile: null }))
      .mockReturnValueOnce(response({ profile: { level: "Beginner" } }));
    render(<SettingsPage />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save preferences" })).toBeEnabled()
    );
    fireEvent.change(screen.getByRole("textbox", { name: /Subjects/ }), {
      target: { value: "Mathematics" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Current level" }), {
      target: { value: "Beginner" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Learning goals" }), {
      target: { value: "Prepare for exams" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Preferences saved"));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/profiles/student",
      expect.objectContaining({ method: "PUT" })
    );
  });
});
