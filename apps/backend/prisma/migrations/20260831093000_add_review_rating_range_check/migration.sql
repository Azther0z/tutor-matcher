-- Prisma cannot express CHECK constraints in schema.prisma, so the 1-5 rating
-- range is enforced here. Keep this in sync with any service-layer validation.
ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_rating_stars_range"
  CHECK ("rating_stars" BETWEEN 1 AND 5);
