import { RequireAuth } from "@/src/components/require-auth";
import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function DashboardPage() {
  return (
    <RequireAuth>
      <RoutePlaceholder
        title="Student dashboard"
        description="The signed-in learner dashboard and navigation shell will be implemented here."
      />
    </RequireAuth>
  );
}
