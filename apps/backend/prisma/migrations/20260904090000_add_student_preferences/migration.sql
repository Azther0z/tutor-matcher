-- CreateTable
CREATE TABLE "student_profiles" (
    "student_profile_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "level" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "preferred_weekdays" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "preferred_start_minute" INTEGER,
    "preferred_end_minute" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "student_profiles_pkey" PRIMARY KEY ("student_profile_id")
);

-- CreateTable
CREATE TABLE "student_profile_subjects" (
    "student_profile_subject_id" SERIAL NOT NULL,
    "profile_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "student_profile_subjects_pkey" PRIMARY KEY ("student_profile_subject_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "student_profiles_user_id_key" ON "student_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_profile_subjects_profile_id_name_key" ON "student_profile_subjects"("profile_id", "name");

-- CreateIndex
CREATE INDEX "student_profile_subjects_name_idx" ON "student_profile_subjects"("name");

-- AddForeignKey
ALTER TABLE "student_profiles" ADD CONSTRAINT "student_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_profile_subjects" ADD CONSTRAINT "student_profile_subjects_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "student_profiles"("student_profile_id") ON DELETE CASCADE ON UPDATE CASCADE;
