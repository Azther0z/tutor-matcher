import { z } from "zod";
import { SubjectFormat } from "../../generated/prisma/enums.ts";

export const tutorSortOptions = ["recommended", "price_asc", "price_desc", "rating"] as const;

// Query strings arrive as text, and an empty value means the filter is not set.
const unset = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const price = z.coerce.number().min(0).max(99_999_999.99);

// DISC-1: every filter is optional, and a subject must match all selected filters.
export const tutorSearchQuerySchema = z
  .object({
    q: z.preprocess(unset, z.string().trim().max(100).optional()),
    tutorName: z.preprocess(unset, z.string().trim().max(100).optional()),
    learningAreaId: z.preprocess(unset, z.uuid().optional()),
    minPrice: z.preprocess(unset, price.optional()),
    maxPrice: z.preprocess(unset, price.positive().optional()),
    minRating: z.preprocess(unset, z.coerce.number().min(0).max(5).multipleOf(0.5).optional()),
    format: z.preprocess(unset, z.enum(SubjectFormat).optional()),
    sort: z.preprocess(unset, z.enum(tutorSortOptions).default("recommended")),
    page: z.preprocess(unset, z.coerce.number().int().min(1).max(1000).default(1)),
    pageSize: z.preprocess(unset, z.coerce.number().int().min(1).max(50).default(12)),
    asOf: z.preprocess(unset, z.iso.datetime().optional()),
  })
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    { message: "The minimum price can't be above the maximum", path: ["minPrice"] }
  );

export type TutorSearchQuery = z.infer<typeof tutorSearchQuerySchema>;

// DISC-4: the subject page shows one Bangkok day; without a date it opens on the next opening.
export const subjectPageQuerySchema = z.object({
  date: z.preprocess(unset, z.iso.date().optional()),
});
