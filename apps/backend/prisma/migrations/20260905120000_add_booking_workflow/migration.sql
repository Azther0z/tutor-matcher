CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'CONFIRMED', 'CANCELLED', 'COMPLETED');

-- Store booking state, price, and time snapshots required by BOOK-1 and BOOK-3.
ALTER TABLE "bookings"
  ALTER COLUMN "zoom_meeting_url" DROP NOT NULL,
  ADD COLUMN "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  ADD COLUMN "is_trial" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "ended_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "cancelled_at" TIMESTAMP(3),
  ADD COLUMN "cancellation_reason" TEXT;

-- A booking may reserve several 30-minute slots and own transfer/refund records.
ALTER TABLE "availabilities" DROP CONSTRAINT IF EXISTS "availabilities_booking_id_key";
ALTER TABLE "payments" DROP CONSTRAINT IF EXISTS "payments_booking_id_key";

CREATE INDEX "availabilities_booking_id_idx" ON "availabilities"("booking_id");
CREATE INDEX "payments_booking_id_idx" ON "payments"("booking_id");
