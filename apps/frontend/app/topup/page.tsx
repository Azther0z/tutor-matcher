import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function TopupPage() {
  return (
    <RoutePlaceholder
      title="Top up credits"
      description="Learners will purchase lesson credits through this route."
      backlogIds={["PAY-1"]}
    />
  );
}
