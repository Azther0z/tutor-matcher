/**
 * Mock-data seed for local development.
 *
 * Seeds fake users and a connected domain fixture using @faker-js/faker. The
 * fixed emails and fixture values keep local checks stable and idempotent.
 *
 * Run with:  npm run gen-mock-data   (or)   just gen-mock-data   (or)   prisma db seed
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
  {
    firstName: "Alice",
    lastName: "Johnson",
    email: "alice@example.com",
    isAdmin: false,
    balance: "0.00",
  },
  {
    firstName: "Bob",
    lastName: "Smith",
    email: "bob@example.com",
    isAdmin: false,
    // Only the development fixture student is funded; production sign-up still starts at zero.
    balance: "10000.00",
  },
  // Carol handles the report fixture below, so she has to be a real admin.
  {
    firstName: "Carol",
    lastName: "Davis",
    email: "carol@example.com",
    isAdmin: true,
    balance: "0.00",
  },
];

const GENERATED_USERS = 20;
const FIXTURE_TUTOR_GOVERNMENT_ID = "development-tutor-001";
const FIXTURE_SUBJECT_NAME = "Mathematics";
const FIXTURE_AVAILABILITY = new Date("2030-01-15T02:00:00.000Z");
const FIXTURE_SLOT_MS = 30 * 60_000;
const FIXTURE_BOOKING_DESCRIPTION = "Development booking fixture";
const FIXTURE_CERTIFICATION_URL = "https://example.com/development-certificate.pdf";
const FIXTURE_MESSAGE = "Development message fixture";
const FIXTURE_REPORT = "Development report fixture";
const LEARNING_AREAS = [
  "Mathematics",
  "Thai Language",
  "English",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "Computer Programming",
  "Business",
  "Accounting",
  "Economics",
  "Art and Design",
  "Music",
  "Social Studies",
  "History",
  "Geography",
  "Computer Science",
  "Data Science",
  "Chinese",
  "Japanese",
  "Korean",
  "French",
  "Public Speaking",
  "Academic Writing",
];

async function main() {
  for (const name of LEARNING_AREAS) {
    await prisma.learningArea.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  for (const user of FIXED_USERS) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: { isAdmin: user.isAdmin, balance: user.balance },
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
        data: { status: "PUBLISHED" },
      })
    : await prisma.tutor.create({
        data: {
          governmentId: FIXTURE_TUTOR_GOVERNMENT_ID,
          bio: "Development tutor fixture",
          status: "PUBLISHED",
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

  // Keep a coherent one-hour booked block plus future unclaimed slots for BOOK-1 testing.
  const fixtureAvailabilities = [];
  for (const startedAt of [
    FIXTURE_AVAILABILITY,
    new Date(FIXTURE_AVAILABILITY.getTime() + FIXTURE_SLOT_MS),
  ]) {
    const existing = await prisma.availability.findFirst({ where: { startedAt } });
    const availability = existing ?? (await prisma.availability.create({ data: { startedAt } }));
    fixtureAvailabilities.push(availability);
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
  }

  for (let offset = 4; offset < 12; offset++) {
    const startedAt = new Date(FIXTURE_AVAILABILITY.getTime() + offset * FIXTURE_SLOT_MS);
    const existing = await prisma.availability.findFirst({ where: { startedAt } });
    const availability = existing ?? (await prisma.availability.create({ data: { startedAt } }));
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
  }

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
          zoomMeetingUrl: "https://zoom.us/j/development-fixture",
          totalAmount: "75.00",
          startedAt: FIXTURE_AVAILABILITY,
          endedAt: new Date(FIXTURE_AVAILABILITY.getTime() + 60 * 60_000),
          status: "CONFIRMED",
          user: { connect: { id: bob.id } },
          subject: { connect: { id: subject.id } },
        },
      });

  if (existingBooking) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: {
        zoomMeetingUrl: "https://zoom.us/j/development-fixture",
        totalAmount: "75.00",
        startedAt: FIXTURE_AVAILABILITY,
        endedAt: new Date(FIXTURE_AVAILABILITY.getTime() + 60 * 60_000),
        status: "CONFIRMED",
        paymentExpiresAt: null,
      },
    });
  }

  for (const availability of fixtureAvailabilities)
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
      data: { amount: "75.00", status: "HOLDING", completedAt: null },
    });
  } else {
    await prisma.payment.create({
      data: {
        type: "TRANSFER",
        amount: "75.00",
        status: "HOLDING",
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
