-- CreateEnum
CREATE TYPE "StudentEducationLevel" AS ENUM ('PRIMARY_SCHOOL', 'LOWER_SECONDARY_SCHOOL', 'UPPER_SECONDARY_SCHOOL', 'VOCATIONAL_CERTIFICATE', 'HIGHER_VOCATIONAL_CERTIFICATE', 'UNIVERSITY', 'WORKING_ADULT');

-- CreateEnum
CREATE TYPE "PreferredLearningPeriod" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'FLEXIBLE');

-- CreateTable
CREATE TABLE "students" (
    "student_id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "education_level" "StudentEducationLevel" NOT NULL,
    "goals" TEXT[],
    "preferred_learning_period" "PreferredLearningPeriod" NOT NULL,
    "preferred_duration_minutes" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "students_pkey" PRIMARY KEY ("student_id")
);

-- CreateTable
CREATE TABLE "learning_areas" (
    "learning_area_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "learning_areas_pkey" PRIMARY KEY ("learning_area_id")
);

-- CreateTable
CREATE TABLE "student_learning_areas" (
    "student_id" INTEGER NOT NULL,
    "learning_area_id" INTEGER NOT NULL,

    CONSTRAINT "student_learning_areas_pkey" PRIMARY KEY ("student_id","learning_area_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "students_user_id_key" ON "students"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "learning_areas_name_key" ON "learning_areas"("name");

-- AddForeignKey
ALTER TABLE "students" ADD CONSTRAINT "students_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_learning_areas" ADD CONSTRAINT "student_learning_areas_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("student_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "student_learning_areas" ADD CONSTRAINT "student_learning_areas_learning_area_id_fkey" FOREIGN KEY ("learning_area_id") REFERENCES "learning_areas"("learning_area_id") ON DELETE RESTRICT ON UPDATE CASCADE;
