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

describe("REV-3 flagging a review's comment", () => {
  it("offers Flag on a comment to a signed-in member, and not to a visitor", () => {
    localStorage.setItem("authToken", "member-token");
    const view = render(<ReviewList reviews={reviews} />);
    expect(screen.getByRole("button", { name: "Flag review by Student A." })).toBeInTheDocument();

    localStorage.clear();
    view.unmount();
    render(<ReviewList reviews={reviews} />);
    expect(screen.queryByRole("button", { name: /Flag review/ })).not.toBeInTheDocument();
  });

  it("shows Flagged on a comment the viewer flagged, and nothing on their own review", () => {
    localStorage.setItem("authToken", "member-token");
    render(
      <ReviewList
        reviews={[
          { ...reviews[0], id: "flagged", flaggedByMe: true, isMine: false },
          { ...reviews[0], id: "mine", reviewer: "Me M.", flaggedByMe: false, isMine: true },
        ]}
      />
    );
    expect(screen.getByText("Flagged")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Flag review/ })).not.toBeInTheDocument();
  });

  it("does not offer Flag on a rating-only review", () => {
    localStorage.setItem("authToken", "member-token");
    render(<ReviewList reviews={[{ ...reviews[0], text: null }]} />);
    expect(screen.queryByRole("button", { name: /Flag review/ })).not.toBeInTheDocument();
  });
});
