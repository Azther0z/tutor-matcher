import { RoutePlaceholder } from "@/src/components/route-placeholder";

// BOOK-1 links here when a learner needs credits; PAY-1 can replace this page later.
export default function WalletTopupPage() {
  return (
    <RoutePlaceholder
      title="Top up credits"
      description="Wallet top-up is handled by the payments flow. Return to your booking after adding credits."
      backlogIds={["PAY-1"]}
    />
  );
}
