-- One-time data-preserving upgrade from the pre-AUTH-4 schema.
-- Run before prisma db push on an existing database. No migration history is maintained.
BEGIN;
LOCK TABLE users, tutors, certifications IN ACCESS EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM tutors t LEFT JOIN users u ON u.tutor_id = t.tutor_id WHERE u.user_id IS NULL) THEN
    RAISE EXCEPTION 'Tutor without an owning user: resolve ownership before upgrading';
  END IF;
  IF EXISTS (SELECT 1 FROM subjects s JOIN tutors t ON t.tutor_id = s.tutor_id WHERE t.status::text IN ('PENDING', 'REJECTED')) THEN
    RAISE EXCEPTION 'Unapproved tutor owns subjects: resolve before upgrading';
  END IF;
END $$;
CREATE TYPE "TutorProfileVersionStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tutor_profile_versions" (
    "profile_version_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "avatar_url" TEXT,
    "bio" TEXT,
    "intro_video_url" TEXT,
    "identification_card_url" TEXT,
    "status" "TutorProfileVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" UUID,
    "rejection_reason" TEXT,

    CONSTRAINT "tutor_profile_versions_pkey" PRIMARY KEY ("profile_version_id")
);

-- CreateTable
CREATE TABLE "tutor_profile_version_certifications" (
    "certification_id" UUID NOT NULL,
    "file_url" TEXT NOT NULL,
    "profile_version_id" UUID NOT NULL,

    CONSTRAINT "tutor_profile_version_certifications_pkey" PRIMARY KEY ("certification_id")
);

INSERT INTO tutor_profile_versions
  (profile_version_id, user_id, avatar_url, bio, intro_video_url, identification_card_url,
   status, created_at, submitted_at, reviewed_at)
SELECT t.tutor_id, u.user_id, t.avatar_url, t.bio, t.intro_video_url, t.identification_card_url,
  CASE WHEN t.status::text IN ('PUBLISHED', 'UNPUBLISHED') THEN 'APPROVED'
       ELSE t.status::text END::"TutorProfileVersionStatus",
  t.enrolled_at, t.enrolled_at,
  NULL
FROM tutors t JOIN users u ON u.tutor_id = t.tutor_id;

INSERT INTO tutor_profile_version_certifications (certification_id, file_url, profile_version_id)
SELECT certification_id, file_url, tutor_id FROM certifications;

UPDATE users SET tutor_id = NULL WHERE tutor_id IN
  (SELECT tutor_id FROM tutors WHERE status::text IN ('PENDING', 'REJECTED'));
DROP TABLE certifications;
DELETE FROM tutors WHERE status::text IN ('PENDING', 'REJECTED');

ALTER TABLE tutors ADD COLUMN current_profile_version_id UUID;
UPDATE tutors SET current_profile_version_id = tutor_id;
ALTER TABLE tutors ALTER COLUMN current_profile_version_id SET NOT NULL;
ALTER TABLE tutors DROP COLUMN avatar_url, DROP COLUMN bio,
  DROP COLUMN identification_card_url, DROP COLUMN intro_video_url;

CREATE TYPE "TutorStatus_new" AS ENUM ('UNPUBLISHED', 'PUBLISHED');
ALTER TABLE tutors ALTER COLUMN status DROP DEFAULT;
ALTER TABLE tutors ALTER COLUMN status TYPE "TutorStatus_new" USING (status::text::"TutorStatus_new");
ALTER TYPE "TutorStatus" RENAME TO "TutorStatus_old";
ALTER TYPE "TutorStatus_new" RENAME TO "TutorStatus";
DROP TYPE "TutorStatus_old";
ALTER TABLE tutors ALTER COLUMN status SET DEFAULT 'UNPUBLISHED';

-- CreateIndex
CREATE INDEX "tutor_profile_versions_user_id_created_at_idx" ON "tutor_profile_versions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "tutor_profile_versions_status_submitted_at_idx" ON "tutor_profile_versions"("status", "submitted_at");

-- CreateIndex
CREATE INDEX "tutor_profile_version_certifications_profile_version_id_idx" ON "tutor_profile_version_certifications"("profile_version_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutors_current_profile_version_id_key" ON "tutors"("current_profile_version_id");

-- AddForeignKey
ALTER TABLE "tutors" ADD CONSTRAINT "tutors_current_profile_version_id_fkey" FOREIGN KEY ("current_profile_version_id") REFERENCES "tutor_profile_versions"("profile_version_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profile_versions" ADD CONSTRAINT "tutor_profile_versions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profile_versions" ADD CONSTRAINT "tutor_profile_versions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_profile_version_certifications" ADD CONSTRAINT "tutor_profile_version_certifications_profile_version_id_fkey" FOREIGN KEY ("profile_version_id") REFERENCES "tutor_profile_versions"("profile_version_id") ON DELETE CASCADE ON UPDATE CASCADE;


COMMIT;
