import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function BookingDetailPage() {
  return (
    <RoutePlaceholder
      title="Booking details"
      description="Booking status, lesson access, and meeting details will be shown here."
      backlogIds={["BOOK-1", "BOOK-2", "BOOK-3", "BOOK-4", "CLASS-1", "CLASS-2"]}
    />
  );
}
