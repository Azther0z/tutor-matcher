import { RequireAuth } from "@/src/components/require-auth";
import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function TutorSettingsPage() {
  return (
    <RequireAuth>
      <RoutePlaceholder
        title="Tutor profile & subjects"
        description="Approved tutors will manage their public listing, subjects, and weekly availability here."
        backlogIds={["PROF-2", "PROF-3"]}
      />
    </RequireAuth>
  );
}
