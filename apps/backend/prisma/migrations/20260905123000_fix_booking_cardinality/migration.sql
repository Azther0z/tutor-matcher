-- Older Prisma migrations created these as indexes rather than table constraints.
DROP INDEX IF EXISTS "availabilities_booking_id_key";
DROP INDEX IF EXISTS "payments_booking_id_key";
