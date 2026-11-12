import { act, render, screen, waitFor } from "@testing-library/react";
import { ReviewList } from "./tutor-public";
import { clearAuthToken } from "@/src/lib/auth";
const fetchMock = jest.fn();
const reviews = [
  {
    id: "r1",
    rating: 5,
    text: "Clear lessons",
    createdAt: "2026-11-12T00:00:00Z",
    subjectName: "Math",
    reviewer: "Student A.",
  },
];
beforeEach(() => {
  localStorage.clear();
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
it("shows a reply loaded from the public API after a new page load", () => {
  render(
    <ReviewList
      reviews={[
        { ...reviews[0], reply: { text: "Glad it helped", repliedAt: "2026-11-12T01:00:00Z" } },
      ]}
      tutorId="t1"
    />
  );
  expect(screen.getByText("Glad it helped")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reply publicly" })).not.toBeInTheDocument();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("shows public reply controls only for the profile owner and removes them on logout", async () => {
  localStorage.setItem("authToken", "owner-token");
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tutor: { id: "t1" } }) });
  render(<ReviewList reviews={reviews} tutorId="t1" />);
  expect(await screen.findByRole("button", { name: "Reply publicly" })).toBeInTheDocument();
  act(() => clearAuthToken());
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Reply publicly" })).not.toBeInTheDocument()
  );
});
it.each([null, { id: "another-tutor" }])(
  "hides reply controls for a nonowner %j",
  async (tutor) => {
    localStorage.setItem("authToken", "token");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tutor }) });
    render(<ReviewList reviews={reviews} tutorId="t1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Reply publicly" })).not.toBeInTheDocument();
  }
);
