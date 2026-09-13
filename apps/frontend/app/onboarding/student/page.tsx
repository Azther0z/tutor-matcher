import { redirect } from "next/navigation";

// Student onboarding and Student profile editing are the same form —
// /settings/student is the single source of truth. This route only exists
// so old links/bookmarks still land somewhere useful.
export default function StudentOnboardingPage() {
  redirect("/settings/student");
}
