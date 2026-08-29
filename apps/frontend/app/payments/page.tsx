import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function PaymentsPage() {
  return (
    <RoutePlaceholder
      title="Payments"
      description="Earnings, payout requests, and payment-method management will live here."
      backlogIds={["PAY-2", "PAY-4"]}
    />
  );
}
