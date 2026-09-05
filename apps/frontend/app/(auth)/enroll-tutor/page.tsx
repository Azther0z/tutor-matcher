import { RequireAuth } from "@/src/components/require-auth";
import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function EnrollTutorPage() {
  return (
    <RequireAuth>
      <RoutePlaceholder
        title="Tutor verification"
        description="Tutors will upload identity and teaching-credential documents here."
        backlogIds={["AUTH-4"]}
      />
    </RequireAuth>
  );
}
