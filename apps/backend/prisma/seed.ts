/**
 * Mock-data seed for local development.
 *
 * Seeds the database with fake `User` rows using @faker-js/faker, plus a few
 * fixed named users so tests and manual checks have stable data. Idempotent —
 * re-running upserts by email.
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

  const count = await prisma.user.count();
  console.log(`Seed complete: ${count} User rows`);
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
