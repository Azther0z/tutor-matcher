/**
 * Mock-data seed for local development.
 *
 * Generates a small but fully-linked dataset (people, tutors, students, admins,
 * classes, availability, bookings, payments, reviews, reports, posts) using
 * @faker-js/faker so the app has realistic data to work against.
 *
 * Run with:  npx prisma db seed   (or)   make gen-mock-data
 */
import { faker } from '@faker-js/faker';

import { prisma } from '../src/lib/prisma';

// Deterministic output so repeated seeds are comparable.
faker.seed(20260828);

const TUTORS = 8;
const STUDENTS = 20;
const ADMINS = 2;

const CATEGORIES = [
  'Mathematics',
  'Physics',
  'Chemistry',
  'Biology',
  'English',
  'Thai',
  'Social Studies',
  'Computer Science',
];

const POSTAL_ADDRESSES = [
  { postalCode: '10110', province: 'Bangkok', district: 'Watthana' },
  { postalCode: '10230', province: 'Bangkok', district: 'Bang Khen' },
  { postalCode: '10400', province: 'Bangkok', district: 'Ratchathewi' },
  { postalCode: '50200', province: 'Chiang Mai', district: 'Muang Chiang Mai' },
  { postalCode: '20000', province: 'Chonburi', district: 'Muang Chonburi' },
  { postalCode: '30000', province: 'Nakhon Ratchasima', district: 'Muang' },
];

function pickSome<T>(items: readonly T[], min = 1, max = 3): T[] {
  const count = faker.number.int({ min, max: Math.min(max, items.length) });
  return faker.helpers.arrayElements(items, count);
}

function timeOnly(hour: number): Date {
  return new Date(Date.UTC(1970, 0, 1, hour, 0, 0));
}

async function reset(): Promise<void> {
  // Order matters: children before parents.
  await prisma.post.deleteMany();
  await prisma.review.deleteMany();
  await prisma.report.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.availableTime.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.classCategory.deleteMany();
  await prisma.class.deleteMany();
  await prisma.studentInterestedCategory.deleteMany();
  await prisma.tutorEducationBackground.deleteMany();
  await prisma.admin.deleteMany();
  await prisma.student.deleteMany();
  await prisma.tutor.deleteMany();
  await prisma.person.deleteMany();
  await prisma.postalAddress.deleteMany();
}

async function createPerson(): Promise<number> {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  const address = faker.helpers.arrayElement(POSTAL_ADDRESSES);

  const person = await prisma.person.create({
    data: {
      username:
        faker.internet.username({ firstName, lastName }).toLowerCase() +
        faker.number.int({ min: 1, max: 999 }),
      password: faker.internet.password({ length: 20 }),
      preferredName:
        faker.helpers.maybe(() => faker.person.firstName(), { probability: 0.4 }) ?? null,
      firstName,
      lastName,
      email: faker.internet.email({ firstName, lastName }).toLowerCase(),
      phoneNumber:
        faker.helpers.maybe(() => faker.phone.number({ style: 'national' }), {
          probability: 0.8,
        }) ?? null,
      profilePicture: faker.helpers.maybe(() => faker.image.avatar(), { probability: 0.5 }) ?? null,
      birthDate: faker.date.birthdate({ min: 15, max: 55, mode: 'age' }),
      subDistrict: faker.location.county(),
      postalCode: address.postalCode,
      lastLogin:
        faker.helpers.maybe(() => faker.date.recent({ days: 30 }), { probability: 0.7 }) ?? null,
    },
  });

  return person.personId;
}

async function main(): Promise<void> {
  await reset();

  await prisma.postalAddress.createMany({ data: POSTAL_ADDRESSES });

  // --- Tutors -------------------------------------------------------------
  const tutorIds: number[] = [];
  for (let i = 0; i < TUTORS; i++) {
    const personId = await createPerson();
    await prisma.tutor.create({
      data: {
        personId,
        bio: faker.person.bio(),
        citizenId: faker.string.numeric(13),
        verificationStatus: faker.helpers.arrayElement(['Pending', 'Verified', 'Rejected']),
        yearStartTeaching: faker.number.int({ min: 2010, max: 2024 }),
        preferredGap: faker.helpers.arrayElement([0, 15, 30, 60]),
        educationHistory: {
          create: pickSome([1, 2], 1, 2).map(() => ({
            institutionName: faker.helpers.arrayElement([
              'Chulalongkorn University',
              'Mahidol University',
              'Thammasat University',
              'Kasetsart University',
            ]),
            degreeLevel: faker.helpers.arrayElement(['Bachelor', 'Master', 'PhD']),
            majorField: faker.helpers.arrayElement(CATEGORIES),
            graduationYear: faker.number.int({ min: 2005, max: 2023 }),
          })),
        },
      },
    });
    tutorIds.push(personId);
  }

  // --- Students ---------------------------------------------------------
  const studentIds: number[] = [];
  for (let i = 0; i < STUDENTS; i++) {
    const personId = await createPerson();
    await prisma.student.create({
      data: {
        personId,
        schoolName: faker.helpers.arrayElement([
          'Triam Udom Suksa School',
          'Suankularb Wittayalai School',
          'Satriwithaya School',
          'Bangkok Christian College',
        ]),
        gradeLevel: faker.helpers.arrayElement(['M.4', 'M.5', 'M.6', 'Year 1', 'Year 2']),
        interests: {
          create: pickSome(CATEGORIES, 1, 4).map((category) => ({ category })),
        },
      },
    });
    studentIds.push(personId);
  }

  // --- Admins ---------------------------------------------------------
  for (let i = 0; i < ADMINS; i++) {
    const personId = await createPerson();
    await prisma.admin.create({
      data: { personId, role: faker.helpers.arrayElement(['Moderator', 'SuperAdmin']) },
    });
  }
  const adminIds = (await prisma.admin.findMany({ select: { personId: true } })).map(
    (a) => a.personId
  );

  // --- Classes + availability + bookings ------------------------------
  for (const tutorId of tutorIds) {
    const classCount = faker.number.int({ min: 1, max: 3 });
    for (let c = 0; c < classCount; c++) {
      const created = await prisma.class.create({
        data: {
          tutorId,
          className: `${faker.helpers.arrayElement(CATEGORIES)} — ${faker.helpers.arrayElement([
            'Beginner',
            'Intermediate',
            'Advanced',
            'Exam Prep',
          ])}`,
          pricePerHour: faker.number.int({ min: 200, max: 1200 }),
          description: faker.lorem.paragraph(),
          categories: {
            create: pickSome(CATEGORIES, 1, 2).map((category) => ({ category })),
          },
        },
      });

      const slotCount = faker.number.int({ min: 3, max: 6 });
      for (let s = 0; s < slotCount; s++) {
        const startHour = faker.number.int({ min: 8, max: 18 });
        const booked = faker.datatype.boolean({ probability: 0.4 });

        let bookingId: number | undefined;
        if (booked) {
          const booking = await prisma.booking.create({
            data: {
              studentId: faker.helpers.arrayElement(studentIds),
              studentMessage:
                faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.6 }) ?? null,
              status: faker.helpers.arrayElement([
                'Pending',
                'Confirmed',
                'Completed',
                'Cancelled',
              ]),
              payment: {
                create: {
                  paymentStatus: faker.helpers.arrayElement(['Pending', 'Paid', 'Refunded']),
                  paymentMethod: faker.helpers.arrayElement([
                    'PromptPay',
                    'Credit Card',
                    'Bank Transfer',
                  ]),
                  transactionProof:
                    faker.helpers.maybe(() => faker.image.url(), { probability: 0.7 }) ?? null,
                },
              },
            },
          });
          bookingId = booking.bookingId;
        }

        await prisma.availableTime.create({
          data: {
            classId: created.classId,
            bookingId,
            availableDate: faker.date.soon({ days: 30 }),
            startTime: timeOnly(startHour),
            endTime: timeOnly(startHour + 1),
            isAvailable: !booked,
          },
        });

        if (bookingId && faker.datatype.boolean({ probability: 0.6 })) {
          const booking = await prisma.booking.findUniqueOrThrow({ where: { bookingId } });
          await prisma.review.create({
            data: {
              studentId: booking.studentId,
              classId: created.classId,
              bookingId,
              ratingScore: faker.number.int({ min: 3, max: 5 }),
              comment:
                faker.helpers.maybe(() => faker.lorem.sentences(2), { probability: 0.8 }) ?? null,
            },
          });
        }
      }

      // --- Posts ------------------------------------------------------
      if (faker.datatype.boolean({ probability: 0.5 })) {
        await prisma.post.create({
          data: {
            tutorId,
            classId: created.classId,
            title: faker.lorem.sentence(),
            contentBody: faker.lorem.paragraphs(2),
            viewCount: faker.number.int({ min: 0, max: 500 }),
          },
        });
      }
    }
  }

  // --- Reports -------------------------------------------------------
  const allPersonIds = [...tutorIds, ...studentIds];
  const reportCount = faker.number.int({ min: 2, max: 5 });
  for (let i = 0; i < reportCount; i++) {
    const [reporterId, reportedPersonId] = faker.helpers.arrayElements(allPersonIds, 2);
    const handled = faker.datatype.boolean();
    await prisma.report.create({
      data: {
        reporterId,
        reportedPersonId,
        handlerAdminId: handled ? faker.helpers.arrayElement(adminIds) : null,
        reportType: faker.helpers.arrayElement([
          'Spam',
          'Harassment',
          'Fraud',
          'Inappropriate Content',
        ]),
        reportMessage: faker.lorem.sentences(2),
        evidenceImage: faker.helpers.maybe(() => faker.image.url(), { probability: 0.5 }) ?? null,
        status: handled ? faker.helpers.arrayElement(['Resolved', 'Dismissed']) : 'Open',
        adminResponseMessage: handled ? faker.lorem.sentence() : null,
      },
    });
  }

  const counts = {
    people: await prisma.person.count(),
    tutors: await prisma.tutor.count(),
    students: await prisma.student.count(),
    admins: await prisma.admin.count(),
    classes: await prisma.class.count(),
    bookings: await prisma.booking.count(),
    reviews: await prisma.review.count(),
    reports: await prisma.report.count(),
    posts: await prisma.post.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
