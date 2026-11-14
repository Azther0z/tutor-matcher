/**
 * Deterministic fixtures for the DISC black-box Playwright suite (e2e/disc.spec.ts).
 *
 * Adds four tutors whose subjects have known prices, ratings and openings, so search,
 * profile and subject-page results can be asserted exactly. Every row uses an `@e2e.test`
 * email or an `E2E ` subject name, so it can be told apart from the development fixtures,
 * and running it again is safe.
 *
 * Run against a disposable local database only:  npm --prefix apps/backend run seed:e2e
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";
import { seedReferenceData } from "./seed-prod.ts";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DAY_MS = 24 * 60 * 60 * 1000;
const SLOT_MS = 30 * 60 * 1000;

// 03:00 UTC is 10:00 in Bangkok, so openings stay on one Bangkok date.
function openingAt(daysAhead: number, offsetSlots = 0) {
  const midnight = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");
  return new Date(
    midnight.getTime() + daysAhead * DAY_MS + 3 * 60 * 60 * 1000 + offsetSlots * SLOT_MS
  );
}

type TutorFixture = {
  tutorId: string;
  subjectId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "PUBLISHED" | "UNPUBLISHED";
  subject: { name: string; description: string; rate: string; area: string };
  rating: number | null;
  openings: Date[];
};

const TUTORS: TutorFixture[] = [
  {
    tutorId: "00000000-0000-4000-8000-0000000000a1",
    subjectId: "00000000-0000-4000-8000-0000000000b1",
    email: "nina@e2e.test",
    firstName: "Nina",
    lastName: "Algebra",
    status: "PUBLISHED",
    subject: {
      name: "E2E Algebra Basics",
      description: "Linear equations and factoring",
      rate: "100.00",
      area: "Mathematics",
    },
    rating: 5,
    // Three consecutive half-hours: draws as one 10:00-11:30 block.
    openings: [openingAt(1), openingAt(1, 1), openingAt(1, 2)],
  },
  {
    tutorId: "00000000-0000-4000-8000-0000000000a2",
    subjectId: "00000000-0000-4000-8000-0000000000b2",
    email: "oscar@e2e.test",
    firstName: "Oscar",
    lastName: "Physics",
    status: "PUBLISHED",
    subject: {
      name: "E2E Physics Mechanics",
      description: "Forces, motion and energy",
      rate: "500.00",
      area: "Physics",
    },
    rating: 3,
    openings: [openingAt(2)],
  },
  {
    tutorId: "00000000-0000-4000-8000-0000000000a3",
    subjectId: "00000000-0000-4000-8000-0000000000b3",
    email: "priya@e2e.test",
    firstName: "Priya",
    lastName: "Chemistry",
    status: "PUBLISHED",
    subject: {
      name: "E2E Chemistry Lab",
      description: "Titration and lab technique",
      rate: "900.00",
      area: "Chemistry",
    },
    rating: null,
    openings: [],
  },
  {
    tutorId: "00000000-0000-4000-8000-0000000000a4",
    subjectId: "00000000-0000-4000-8000-0000000000b4",
    email: "quinn@e2e.test",
    firstName: "Quinn",
    lastName: "Hidden",
    status: "UNPUBLISHED",
    subject: {
      name: "E2E Hidden Subject",
      description: "Belongs to an unpublished tutor",
      rate: "300.00",
      area: "Mathematics",
    },
    rating: null,
    openings: [],
  },
];

async function seedTutor(fixture: TutorFixture, studentId: string, reviewerId: string) {
  const user = await prisma.user.upsert({
    where: { email: fixture.email },
    update: {},
    create: {
      email: fixture.email,
      firstName: fixture.firstName,
      lastName: fixture.lastName,
      password: "development-only",
    },
  });

  const tutor =
    (await prisma.tutor.findFirst({ where: { user: { id: user.id } } })) ??
    (await prisma.tutor.create({
      data: {
        id: fixture.tutorId,
        status: fixture.status,
        currentProfileVersion: {
          create: {
            userId: user.id,
            bio: `${fixture.firstName} teaches ${fixture.subject.name}.`,
            identificationCardUrl: "https://example.com/e2e-identification-card.pdf",
            introVideoUrl: "https://example.com/e2e-intro.mp4",
            status: "APPROVED",
            submittedAt: new Date(),
            reviewedAt: new Date(),
            reviewedById: reviewerId,
          },
        },
      },
    }));
  await prisma.user.update({
    where: { id: user.id },
    data: { tutor: { connect: { id: tutor.id } } },
  });
  await prisma.tutor.update({ where: { id: tutor.id }, data: { status: fixture.status } });

  const subject =
    (await prisma.subject.findFirst({
      where: { name: fixture.subject.name, tutorId: tutor.id },
    })) ??
    (await prisma.subject.create({
      data: {
        id: fixture.subjectId,
        name: fixture.subject.name,
        description: fixture.subject.description,
        hourlyRate: fixture.subject.rate,
        tutor: { connect: { id: tutor.id } },
      },
    }));

  const area = await prisma.learningArea.findUniqueOrThrow({
    where: { name: fixture.subject.area },
  });
  await prisma.subjectLearningArea.upsert({
    where: { subjectId_learningAreaId: { subjectId: subject.id, learningAreaId: area.id } },
    update: {},
    create: { subjectId: subject.id, learningAreaId: area.id },
  });

  for (const startedAt of fixture.openings) {
    const availability = await prisma.availability.upsert({
      where: { tutorId_startedAt: { tutorId: tutor.id, startedAt } },
      update: { isOpen: true },
      create: { tutorId: tutor.id, startedAt },
    });
    await prisma.availabilitySubject.upsert({
      where: {
        availabilityId_subjectId: { availabilityId: availability.id, subjectId: subject.id },
      },
      update: {},
      create: { availabilityId: availability.id, subjectId: subject.id },
    });
  }

  if (fixture.rating !== null) {
    const description = `E2E rating fixture for ${subject.id}`;
    const startedAt = new Date("2026-01-05T03:00:00.000Z");
    const booking =
      (await prisma.booking.findFirst({ where: { description, subjectId: subject.id } })) ??
      (await prisma.booking.create({
        data: {
          description,
          totalAmount: fixture.subject.rate,
          startedAt,
          endedAt: new Date(startedAt.getTime() + SLOT_MS),
          status: "COMPLETED",
          user: { connect: { id: studentId } },
          subject: { connect: { id: subject.id } },
        },
      }));
    await prisma.review.upsert({
      where: { bookingId: booking.id },
      update: { ratingStars: fixture.rating },
      create: {
        ratingStars: fixture.rating,
        text: "E2E review fixture",
        user: { connect: { id: studentId } },
        subject: { connect: { id: subject.id } },
        booking: { connect: { id: booking.id } },
      },
    });
  }
}

async function main() {
  await seedReferenceData(prisma);

  const reviewer = await prisma.user.upsert({
    where: { email: "admin@e2e.test" },
    update: { isAdmin: true },
    create: {
      email: "admin@e2e.test",
      firstName: "E2E",
      lastName: "Admin",
      password: "development-only",
      isAdmin: true,
    },
  });
  const student = await prisma.user.upsert({
    where: { email: "student@e2e.test" },
    update: {},
    create: {
      email: "student@e2e.test",
      firstName: "E2E",
      lastName: "Student",
      password: "development-only",
    },
  });

  for (const fixture of TUTORS) await seedTutor(fixture, student.id, reviewer.id);

  console.log(`E2E seed complete: ${TUTORS.length} tutors`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
