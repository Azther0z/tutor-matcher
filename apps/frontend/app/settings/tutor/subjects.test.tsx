import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import TutorSettingsPage from "./page";
import {
  approvedTutor,
  jsonApplicationResponse,
  jsonResponse,
} from "@/src/test/tutor-profile-fixtures";
import type { SubjectOffering } from "@/src/lib/subjects";

const fetchMock = jest.fn();
const areasPath = "/api/discovery/learning-areas";
const mathematics = { id: "area-math", name: "Mathematics" };
const english = { id: "area-english", name: "English" };
const learningAreas = [
  english,
  mathematics,
  { id: "area-physics", name: "Physics" },
  { id: "area-other", name: "Other" },
];
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/settings/tutor",
  useRouter: () => ({ replace: mockReplace }),
}));
const first: SubjectOffering = {
  id: "subject-a",
  name: "English",
  description: "Speaking practice",
  hourlyRate: "125.50",
  format: "ONLINE",
  learningAreas: [english],
};
const second: SubjectOffering = {
  ...first,
  id: "subject-b",
  name: "Mathematics",
  description: "Algebra",
  hourlyRate: "99.99",
  learningAreas: [mathematics],
};
const subjectsPath = "/api/profiles/me/tutor/subjects";
function profile(subjects: SubjectOffering[] = []) {
  return jsonApplicationResponse({
    status: "APPROVED",
    tutor: { ...approvedTutor, status: "UNPUBLISHED", subjects },
    version: null,
  });
}
async function load(subjects: SubjectOffering[] = []) {
  fetchMock.mockResolvedValueOnce(profile(subjects));
  const rendered = render(<TutorSettingsPage />);
  await screen.findByRole("region", { name: "Subjects" });
  return rendered;
}
const area = (name: string) => screen.getByRole("button", { name });
function fill(values = first) {
  fireEvent.change(screen.getByLabelText("Subject name"), { target: { value: values.name } });
  fireEvent.change(screen.getByLabelText("Subject description"), {
    target: { value: values.description },
  });
  fireEvent.change(screen.getByLabelText("Hourly rate (THB)"), {
    target: { value: values.hourlyRate },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  // The public learning-area list is answered separately, so fetchMock sees only tutor calls.
  global.fetch = jest.fn((path: string, init?: RequestInit) =>
    path === areasPath ? Promise.resolve(jsonResponse({ learningAreas })) : fetchMock(path, init)
  ) as jest.Mock;
  localStorage.clear();
  localStorage.setItem("authToken", "token");
});

it("starts with one Add subject button below Verification and persists a duplicate-named offering", async () => {
  const rendered = await load([first]);
  const region = screen.getByRole("region", { name: "Subjects" });
  expect(
    screen.getByText("Verification").compareDocumentPosition(region) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  fireEvent.click(within(region).getByRole("button", { name: "Add subject" }));
  expect(screen.getByLabelText("Format")).toHaveValue("ONLINE");
  expect(screen.getAllByRole("option")).toHaveLength(1);
  fill({ ...first, name: " English " });
  fireEvent.click(await screen.findByRole("button", { name: "English" }));
  const duplicate = { ...first, id: "subject-c" };
  fetchMock.mockResolvedValueOnce(jsonResponse({ subject: duplicate }, 201));
  fireEvent.submit(screen.getByRole("form", { name: "Add subject" }));
  expect(await screen.findByText("Subject added.")).toBeInTheDocument();
  expect(screen.getAllByRole("listitem", { name: "Subject: English" })).toHaveLength(2);
  expect(fetchMock).toHaveBeenLastCalledWith(
    subjectsPath,
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({
        name: "English",
        description: first.description,
        hourlyRate: first.hourlyRate,
        format: "ONLINE",
        learningAreaIds: [english.id],
      }),
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
    })
  );
  rendered.unmount();
  await load([first, duplicate]);
  expect(screen.getAllByRole("listitem", { name: "Subject: English" })).toHaveLength(2);
});

it("edits only the selected row inline and reloads the saved values", async () => {
  const rendered = await load([first, second]);
  const firstRow = screen.getByRole("listitem", { name: "Subject: English" });
  fireEvent.click(within(firstRow).getByRole("button", { name: "Edit" }));
  expect(within(firstRow).getByRole("form", { name: "Edit subject" })).toBeInTheDocument();
  expect(screen.getByLabelText("Subject name")).toHaveValue(first.name);
  expect(await screen.findByRole("button", { name: "English" })).toHaveAttribute(
    "aria-pressed",
    "true"
  );
  const changed = { ...first, name: "IELTS Speaking", hourlyRate: "0.01" };
  fill(changed);
  fetchMock.mockResolvedValueOnce(jsonResponse({ subject: changed }));
  fireEvent.submit(screen.getByRole("form", { name: "Edit subject" }));
  expect(await screen.findByText("Subject updated.")).toBeInTheDocument();
  expect(fetchMock).toHaveBeenLastCalledWith(
    `${subjectsPath}/${first.id}`,
    expect.objectContaining({ method: "PUT" })
  );
  expect(screen.getByRole("listitem", { name: "Subject: Mathematics" })).toHaveTextContent(
    "Algebra"
  );
  expect(screen.getByRole("listitem", { name: "Subject: IELTS Speaking" })).toHaveTextContent(
    "฿0.01 / hr · Online"
  );
  rendered.unmount();
  await load([changed, second]);
  expect(screen.getByRole("listitem", { name: "Subject: IELTS Speaking" })).toBeInTheDocument();
  expect(screen.getByRole("listitem", { name: "Subject: Mathematics" })).toHaveTextContent(
    "฿99.99"
  );
});

it("rejects missing content, zero and excess decimals without sending a save", async () => {
  await load();
  fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
  fireEvent.submit(screen.getByRole("form", { name: "Add subject" }));
  expect(screen.getByText("Enter a subject name.")).toBeInTheDocument();
  expect(screen.getByText("Enter a subject description.")).toBeInTheDocument();
  expect(screen.getByText("Choose at least one learning area.")).toBeInTheDocument();
  for (const hourlyRate of ["0", "-1", "1.001", "100000000", "1e2"]) {
    fill({ ...first, hourlyRate });
    fireEvent.submit(screen.getByRole("form", { name: "Add subject" }));
    expect(screen.getByLabelText("Hourly rate (THB)")).toHaveAttribute("aria-invalid", "true");
  }
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("cancels add and inline changes without saving", async () => {
  await load([first]);
  fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
  fill(second);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fill(second);
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("listitem", { name: "Subject: English" })).toHaveTextContent(
    "Speaking practice"
  );
  expect(screen.queryByRole("form")).not.toBeInTheDocument();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("keeps unsaved input on server failure and supports retry", async () => {
  await load([first]);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fill(second);
  fetchMock.mockResolvedValueOnce(jsonResponse({ message: "Please try again." }, 409));
  fireEvent.submit(screen.getByRole("form", { name: "Edit subject" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Please try again.");
  expect(screen.getByLabelText("Subject name")).toHaveValue(second.name);
  fetchMock.mockResolvedValueOnce(jsonResponse({ subject: { ...second, id: first.id } }));
  fireEvent.submit(screen.getByRole("form", { name: "Edit subject" }));
  expect(await screen.findByText("Subject updated.")).toBeInTheDocument();
});

it("prevents repeated submission while a save is pending", async () => {
  await load();
  fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
  fill();
  fireEvent.click(await screen.findByRole("button", { name: "English" }));
  let resolveSave!: (response: ReturnType<typeof jsonResponse>) => void;
  fetchMock.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveSave = resolve;
    })
  );
  const form = screen.getByRole("form", { name: "Add subject" });
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  resolveSave(jsonResponse({ subject: first }, 201));
  expect(await screen.findByText("Subject added.")).toBeInTheDocument();
});

it("tags a subject with at most three learning areas and shows them in the list", async () => {
  await load();
  fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
  fill(second);
  fireEvent.click(await screen.findByRole("button", { name: "Mathematics" }));
  fireEvent.click(area("Physics"));
  fireEvent.click(area("Other"));
  expect(area("English")).toBeDisabled();
  fireEvent.click(area("Other"));
  expect(area("English")).toBeEnabled();
  expect(area("Physics")).toHaveAttribute("aria-pressed", "true");

  const saved = {
    ...second,
    learningAreas: [mathematics, { id: "area-physics", name: "Physics" }],
  };
  fetchMock.mockResolvedValueOnce(jsonResponse({ subject: saved }, 201));
  fireEvent.submit(screen.getByRole("form", { name: "Add subject" }));
  expect(await screen.findByText("Subject added.")).toBeInTheDocument();
  expect(JSON.parse(fetchMock.mock.lastCall[1].body).learningAreaIds).toEqual([
    "area-math",
    "area-physics",
  ]);
  expect(screen.getByRole("listitem", { name: "Subject: Mathematics" })).toHaveTextContent(
    "Mathematics, Physics"
  );
});
