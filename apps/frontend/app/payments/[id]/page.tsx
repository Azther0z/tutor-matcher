import { RoutePlaceholder } from "@/src/components/route-placeholder";

export default function PaymentDetailPage() {
  return (
    <RoutePlaceholder
      title="Payment status"
      description="The status and details of a payment or refund request will be shown here."
      backlogIds={["PAY-3"]}
    />
  );
}
