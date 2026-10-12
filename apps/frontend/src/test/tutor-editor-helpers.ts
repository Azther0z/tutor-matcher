import { fireEvent, screen, within } from "@testing-library/react";

export async function openTutorEditor() {
  const drafts = await screen.findByRole("region", { name: "Saved drafts" });
  const edit = within(drafts).queryAllByRole("button", { name: /^Edit draft / })[0];
  fireEvent.click(edit ?? within(drafts).getByRole("button", { name: "New draft" }));
  return screen.findByRole("dialog", { name: "Draft" });
}

export async function confirmTutorSubmission() {
  const confirmation = await screen.findByRole("dialog", { name: "Submit draft for review?" });
  const consent = within(confirmation).getByRole("checkbox") as HTMLInputElement;
  if (!consent.checked) fireEvent.click(consent);
  fireEvent.click(within(confirmation).getByRole("button", { name: "Confirm submit" }));
}
