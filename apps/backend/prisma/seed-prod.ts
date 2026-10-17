/**
 * Reference-data seed for every environment, including production.
 *
 * Only upserts the fixed lists the product needs (learning areas), so running it
 * again is safe. Local fixtures live in seed-mock.ts, which runs this first.
 *
 * Run with:  npm run db:seed:prod   (after `npm run build`)
 */
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client.ts";

// Students pick these at onboarding and tutors tag subjects with them (DISC-1).
export const LEARNING_AREAS = [
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
  "Other",
];

export async function seedReferenceData(prisma: PrismaClient) {
  for (const name of LEARNING_AREAS) {
    await prisma.learningArea.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
}

async function main() {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seedReferenceData(prisma);
    console.log(`Reference seed complete: ${LEARNING_AREAS.length} learning areas`);
  } finally {
    await prisma.$disconnect();
  }
}

// seed-mock.ts imports this file, so only run when executed directly.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
