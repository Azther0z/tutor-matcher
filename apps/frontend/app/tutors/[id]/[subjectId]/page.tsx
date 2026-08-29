import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function TutorSubjectReviewsPage() {
  return (
    <RoutePlaceholder
      title="Tutor subject reviews"
      description="Reviews for a tutor and subject will be scoped to this dynamic route."
      backlogIds={["REV-1"]}
    />
  );
}
