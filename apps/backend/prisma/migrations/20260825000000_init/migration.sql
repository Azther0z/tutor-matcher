-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "PostalAddress" (
    "PostalCode" VARCHAR(10) NOT NULL,
    "Province" VARCHAR(50) NOT NULL,
    "District" VARCHAR(50) NOT NULL,
    CONSTRAINT "PostalAddress_pkey" PRIMARY KEY ("PostalCode")
);

-- CreateTable
CREATE TABLE "Person" (
    "PersonID" SERIAL NOT NULL,
    "Username" VARCHAR(50) NOT NULL,
    "Password" VARCHAR(255) NOT NULL,
    "PreferredName" VARCHAR(50),
    "FirstName" VARCHAR(50) NOT NULL,
    "LastName" VARCHAR(50) NOT NULL,
    "Email" VARCHAR(100) NOT NULL,
    "PhoneNumber" VARCHAR(20),
    "ProfilePicture" VARCHAR(255),
    "BirthDate" DATE,
    "SubDistrict" VARCHAR(50),
    "PostalCode" VARCHAR(10),
    "DateJoined" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "LastLogin" TIMESTAMP(3),
    CONSTRAINT "Person_pkey" PRIMARY KEY ("PersonID")
);

-- CreateTable
CREATE TABLE "Tutor" (
    "PersonID" INTEGER NOT NULL,
    "Bio" TEXT,
    "CitizenID" VARCHAR(20) NOT NULL,
    "VerificationStatus" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "YearStartTeaching" SMALLINT,
    "PreferredGap" INTEGER,
    CONSTRAINT "Tutor_pkey" PRIMARY KEY ("PersonID")
);

-- CreateTable
CREATE TABLE "TutorEducationBackground" (
    "EducationID" SERIAL NOT NULL,
    "PersonID" INTEGER NOT NULL,
    "InstitutionName" VARCHAR(100) NOT NULL,
    "DegreeLevel" VARCHAR(100) NOT NULL,
    "MajorField" VARCHAR(100) NOT NULL,
    "GraduationYear" INTEGER NOT NULL,
    CONSTRAINT "TutorEducationBackground_pkey" PRIMARY KEY ("EducationID")
);

-- CreateTable
CREATE TABLE "Student" (
    "PersonID" INTEGER NOT NULL,
    "SchoolName" VARCHAR(100),
    "GradeLevel" VARCHAR(20),
    CONSTRAINT "Student_pkey" PRIMARY KEY ("PersonID")
);

-- CreateTable
CREATE TABLE "StudentInterestedCategory" (
    "PersonID" INTEGER NOT NULL,
    "Category" VARCHAR(50) NOT NULL,
    CONSTRAINT "StudentInterestedCategory_pkey" PRIMARY KEY ("PersonID", "Category")
);

-- CreateTable
CREATE TABLE "Admin" (
    "PersonID" INTEGER NOT NULL,
    "Role" VARCHAR(50) NOT NULL,
    CONSTRAINT "Admin_pkey" PRIMARY KEY ("PersonID")
);

-- CreateTable
CREATE TABLE "Class" (
    "ClassID" SERIAL NOT NULL,
    "TutorID" INTEGER NOT NULL,
    "ClassName" VARCHAR(100) NOT NULL,
    "PricePerHour" DECIMAL(10, 2) NOT NULL,
    "Description" TEXT,
    CONSTRAINT "Class_pkey" PRIMARY KEY ("ClassID")
);

-- CreateTable
CREATE TABLE "ClassCategory" (
    "ClassID" INTEGER NOT NULL,
    "Category" VARCHAR(50) NOT NULL,
    CONSTRAINT "ClassCategory_pkey" PRIMARY KEY ("ClassID", "Category")
);

-- CreateTable
CREATE TABLE "AvailableTime" (
    "SlotID" SERIAL NOT NULL,
    "ClassID" INTEGER NOT NULL,
    "BookingID" INTEGER,
    "AvailableDate" DATE NOT NULL,
    "StartTime" TIME NOT NULL,
    "EndTime" TIME NOT NULL,
    "IsAvailable" BOOLEAN NOT NULL,
    CONSTRAINT "AvailableTime_pkey" PRIMARY KEY ("SlotID")
);

-- CreateTable
CREATE TABLE "Booking" (
    "BookingID" SERIAL NOT NULL,
    "StudentID" INTEGER NOT NULL,
    "StudentMessage" TEXT,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "BookingTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Booking_pkey" PRIMARY KEY ("BookingID")
);

-- CreateTable
CREATE TABLE "Payment" (
    "PaymentID" SERIAL NOT NULL,
    "BookingID" INTEGER NOT NULL,
    "PaymentStatus" VARCHAR(20) NOT NULL DEFAULT 'Pending',
    "PaymentMethod" VARCHAR(50),
    "TransactionProof" TEXT,
    "PaymentTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_pkey" PRIMARY KEY ("PaymentID")
);

-- CreateTable
CREATE TABLE "Review" (
    "ReviewID" SERIAL NOT NULL,
    "StudentID" INTEGER NOT NULL,
    "ClassID" INTEGER NOT NULL,
    "BookingID" INTEGER,
    "RatingScore" SMALLINT NOT NULL,
    "Comment" TEXT,
    "ReviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_pkey" PRIMARY KEY ("ReviewID")
);

-- CreateTable
CREATE TABLE "Report" (
    "ReportID" SERIAL NOT NULL,
    "ReporterID" INTEGER NOT NULL,
    "ReportedPersonID" INTEGER NOT NULL,
    "HandlerAdminID" INTEGER,
    "ReportType" VARCHAR(50) NOT NULL,
    "ReportMessage" TEXT NOT NULL,
    "EvidenceImage" TEXT,
    "Status" VARCHAR(20) NOT NULL DEFAULT 'Open',
    "AdminResponseMessage" TEXT,
    "ReportTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Report_pkey" PRIMARY KEY ("ReportID")
);

-- CreateTable
CREATE TABLE "Post" (
    "PostID" SERIAL NOT NULL,
    "TutorID" INTEGER NOT NULL,
    "ClassID" INTEGER,
    "Title" VARCHAR(255) NOT NULL,
    "ContentBody" TEXT NOT NULL,
    "PostedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ViewCount" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Post_pkey" PRIMARY KEY ("PostID")
);

-- CreateIndex
CREATE UNIQUE INDEX "Person_Username_key" ON "Person"("Username");
CREATE UNIQUE INDEX "Person_Email_key" ON "Person"("Email");
CREATE UNIQUE INDEX "Tutor_CitizenID_key" ON "Tutor"("CitizenID");
CREATE UNIQUE INDEX "Payment_BookingID_key" ON "Payment"("BookingID");

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_PostalCode_fkey" FOREIGN KEY ("PostalCode") REFERENCES "PostalAddress"("PostalCode") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Tutor" ADD CONSTRAINT "Tutor_PersonID_fkey" FOREIGN KEY ("PersonID") REFERENCES "Person"("PersonID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TutorEducationBackground" ADD CONSTRAINT "TutorEducationBackground_PersonID_fkey" FOREIGN KEY ("PersonID") REFERENCES "Tutor"("PersonID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Student" ADD CONSTRAINT "Student_PersonID_fkey" FOREIGN KEY ("PersonID") REFERENCES "Person"("PersonID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentInterestedCategory" ADD CONSTRAINT "StudentInterestedCategory_PersonID_fkey" FOREIGN KEY ("PersonID") REFERENCES "Student"("PersonID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Admin" ADD CONSTRAINT "Admin_PersonID_fkey" FOREIGN KEY ("PersonID") REFERENCES "Person"("PersonID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Class" ADD CONSTRAINT "Class_TutorID_fkey" FOREIGN KEY ("TutorID") REFERENCES "Tutor"("PersonID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassCategory" ADD CONSTRAINT "ClassCategory_ClassID_fkey" FOREIGN KEY ("ClassID") REFERENCES "Class"("ClassID") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvailableTime" ADD CONSTRAINT "AvailableTime_ClassID_fkey" FOREIGN KEY ("ClassID") REFERENCES "Class"("ClassID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AvailableTime" ADD CONSTRAINT "AvailableTime_BookingID_fkey" FOREIGN KEY ("BookingID") REFERENCES "Booking"("BookingID") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_StudentID_fkey" FOREIGN KEY ("StudentID") REFERENCES "Student"("PersonID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_BookingID_fkey" FOREIGN KEY ("BookingID") REFERENCES "Booking"("BookingID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_StudentID_fkey" FOREIGN KEY ("StudentID") REFERENCES "Student"("PersonID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_ClassID_fkey" FOREIGN KEY ("ClassID") REFERENCES "Class"("ClassID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_BookingID_fkey" FOREIGN KEY ("BookingID") REFERENCES "Booking"("BookingID") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_ReporterID_fkey" FOREIGN KEY ("ReporterID") REFERENCES "Person"("PersonID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_ReportedPersonID_fkey" FOREIGN KEY ("ReportedPersonID") REFERENCES "Person"("PersonID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Report" ADD CONSTRAINT "Report_HandlerAdminID_fkey" FOREIGN KEY ("HandlerAdminID") REFERENCES "Admin"("PersonID") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_TutorID_fkey" FOREIGN KEY ("TutorID") REFERENCES "Tutor"("PersonID") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Post" ADD CONSTRAINT "Post_ClassID_fkey" FOREIGN KEY ("ClassID") REFERENCES "Class"("ClassID") ON DELETE SET NULL ON UPDATE CASCADE;
