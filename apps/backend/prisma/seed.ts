/**
 * Mock-data seed for local development.
 *
 * Seeds fake users and a connected domain fixture using @faker-js/faker. The
 * fixed emails and fixture values keep local checks stable and idempotent.
 *
 * Run with:  npm run gen-mock-data   (or)   just gen-mock-data   (or)   prisma db seed
 *
 * When the domain schema lands, expand this to seed those models too.
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { faker } from "@faker-js/faker";

import { PrismaClient } from "../src/generated/prisma/client.ts";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

// Deterministic output so repeated seeds are comparable.
faker.seed(20260828);

const FIXED_USERS = [
  { firstName: "Alice", lastName: "Johnson", email: "alice@example.com" },
  { firstName: "Bob", lastName: "Smith", email: "bob@example.com" },
  { firstName: "Carol", lastName: "Davis", email: "carol@example.com" },
];

const GENERATED_USERS = 20;
const FIXTURE_TUTOR_GOVERNMENT_ID = "development-tutor-001";
const FIXTURE_SUBJECT_NAME = "Mathematics";
const FIXTURE_AVAILABILITY = new Date("2026-09-01T10:00:00.000Z");
const FIXTURE_BOOKING_DESCRIPTION = "Development booking fixture";
const FIXTURE_CERTIFICATION_URL = "https://example.com/development-certificate.pdf";
const FIXTURE_MESSAGE = "Development message fixture";
const FIXTURE_REPORT = "Development report fixture";

async function main() {
  for (const user of FIXED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: { ...user, password: "development-only" },
    });
  }

  for (let i = 0; i < GENERATED_USERS; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();

    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { firstName, lastName, email, password: "development-only" },
    });
  }

  const alice = await prisma.user.findUniqueOrThrow({
    where: { email: "alice@example.com" },
  });
  const bob = await prisma.user.findUniqueOrThrow({
    where: { email: "bob@example.com" },
  });
  const carol = await prisma.user.findUniqueOrThrow({
    where: { email: "carol@example.com" },
  });

  const existingTutor = await prisma.tutor.findFirst({
    where: { governmentId: FIXTURE_TUTOR_GOVERNMENT_ID },
  });
  const tutor = existingTutor
    ? await prisma.tutor.update({
        where: { id: existingTutor.id },
        data: { isPublished: true },
      })
    : await prisma.tutor.create({
        data: {
          governmentId: FIXTURE_TUTOR_GOVERNMENT_ID,
          bio: "Development tutor fixture",
          isPublished: true,
        },
      });

  await prisma.user.update({
    where: { id: alice.id },
    data: { tutor: { connect: { id: tutor.id } } },
  });

  const existingSubject = await prisma.subject.findFirst({
    where: { name: FIXTURE_SUBJECT_NAME, tutorId: tutor.id },
  });
  const subject = existingSubject
    ? await prisma.subject.update({
        where: { id: existingSubject.id },
        data: { hourlyRate: "75.00" },
      })
    : await prisma.subject.create({
        data: {
          name: FIXTURE_SUBJECT_NAME,
          description: "Development subject fixture",
          hourlyRate: "75.00",
          tutor: { connect: { id: tutor.id } },
        },
      });

  const existingAvailability = await prisma.availability.findFirst({
    where: { startedAt: FIXTURE_AVAILABILITY },
  });
  const availability = existingAvailability
    ? existingAvailability
    : await prisma.availability.create({
        data: { startedAt: FIXTURE_AVAILABILITY },
      });

  await prisma.availabilitySubject.upsert({
    where: {
      availabilityId_subjectId: {
        availabilityId: availability.id,
        subjectId: subject.id,
      },
    },
    update: {},
    create: {
      availability: { connect: { id: availability.id } },
      subject: { connect: { id: subject.id } },
    },
  });

  const existingBooking = await prisma.booking.findFirst({
    where: {
      userId: bob.id,
      subjectId: subject.id,
      description: FIXTURE_BOOKING_DESCRIPTION,
    },
  });
  const booking = existingBooking
    ? existingBooking
    : await prisma.booking.create({
        data: {
          description: FIXTURE_BOOKING_DESCRIPTION,
          user: { connect: { id: bob.id } },
          subject: { connect: { id: subject.id } },
        },
      });

  await prisma.availability.update({
    where: { id: availability.id },
    data: { booking: { connect: { id: booking.id } } },
  });

  const existingPayment = await prisma.payment.findFirst({
    where: { bookingId: booking.id, type: "TRANSFER" },
  });
  if (existingPayment) {
    await prisma.payment.update({
      where: { id: existingPayment.id },
      data: { amount: "75.00", status: "COMPLETED" },
    });
  } else {
    await prisma.payment.create({
      data: {
        type: "TRANSFER",
        amount: "75.00",
        status: "COMPLETED",
        fromUser: { connect: { id: bob.id } },
        toUser: { connect: { id: alice.id } },
        booking: { connect: { id: booking.id } },
      },
    });
  }

  const existingReview = await prisma.review.findFirst({
    where: { userId: bob.id, subjectId: subject.id, bookingId: booking.id },
  });
  if (!existingReview) {
    await prisma.review.create({
      data: {
        ratingStars: 5,
        text: "Development review fixture",
        user: { connect: { id: bob.id } },
        subject: { connect: { id: subject.id } },
        booking: { connect: { id: booking.id } },
      },
    });
  }

  const existingCertification = await prisma.certification.findFirst({
    where: { tutorId: tutor.id, fileUrl: FIXTURE_CERTIFICATION_URL },
  });
  if (!existingCertification) {
    await prisma.certification.create({
      data: {
        fileUrl: FIXTURE_CERTIFICATION_URL,
        tutor: { connect: { id: tutor.id } },
      },
    });
  }

  const existingMessage = await prisma.message.findFirst({
    where: { fromUserId: bob.id, toUserId: alice.id, message: FIXTURE_MESSAGE },
  });
  if (!existingMessage) {
    await prisma.message.create({
      data: {
        message: FIXTURE_MESSAGE,
        fromUser: { connect: { id: bob.id } },
        toUser: { connect: { id: alice.id } },
      },
    });
  }

  const existingReport = await prisma.report.findFirst({
    where: {
      message: FIXTURE_REPORT,
      adminUserId: carol.id,
      reporterUserId: bob.id,
      reportedUserId: alice.id,
    },
  });
  if (!existingReport) {
    await prisma.report.create({
      data: {
        message: FIXTURE_REPORT,
        adminUser: { connect: { id: carol.id } },
        reporterUser: { connect: { id: bob.id } },
        reportedUser: { connect: { id: alice.id } },
      },
    });
  }

  const count = await prisma.user.count();
  console.log(`Seed complete: ${count} User rows and connected domain fixtures`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
