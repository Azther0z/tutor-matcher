import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function TutorDetailPage() {
  return (
    <RoutePlaceholder
      title="Tutor profile"
      description="A tutor's public profile, messaging entry point, and reviews will be shown here."
      backlogIds={["DISC-3", "MSG-1", "REV-2", "REV-3"]}
    />
  );
}
