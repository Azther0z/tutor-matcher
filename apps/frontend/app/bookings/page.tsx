import { RequireAuth } from "@/src/components/require-auth";
import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function BookingsPage() {
  return (
    <RequireAuth>
      <RoutePlaceholder
        title="Your bookings"
        description="All bookings, tabbed by status — All, Upcoming, Payment due, Past — will be implemented here."
        backlogIds={["BOOK-1", "BOOK-2", "BOOK-3", "BOOK-4"]}
      />
    </RequireAuth>
  );
}
