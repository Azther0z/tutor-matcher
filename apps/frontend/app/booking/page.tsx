import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function BookingPage() {
  return (
    <RoutePlaceholder
      title="Book a lesson"
      description="Book and manage your lessons."
      backlogIds={["BOOK-1", "BOOK-2", "BOOK-3", "BOOK-4", "BOOK-5", "BOOK-6"]}
    />
  );
}
