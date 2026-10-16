import { z } from "zod";
import { SubjectFormat } from "../../generated/prisma/enums.ts";

export const tutorSortOptions = ["recommended", "price_asc", "price_desc", "rating"] as const;

// Query strings arrive as text, and an empty value means the filter is not set.
const unset = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

// DISC-1: every filter is optional, and a tutor must match all selected filters.
export const tutorSearchQuerySchema = z.object({
  q: z.preprocess(unset, z.string().trim().max(100).optional()),
  learningAreaId: z.preprocess(unset, z.uuid().optional()),
  maxPrice: z.preprocess(unset, z.coerce.number().positive().max(99_999_999.99).optional()),
  minRating: z.preprocess(unset, z.coerce.number().min(0).max(5).optional()),
  format: z.preprocess(unset, z.enum(SubjectFormat).optional()),
  sort: z.preprocess(unset, z.enum(tutorSortOptions).default("recommended")),
  page: z.preprocess(unset, z.coerce.number().int().min(1).max(1000).default(1)),
  pageSize: z.preprocess(unset, z.coerce.number().int().min(1).max(50).default(12)),
});

export type TutorSearchQuery = z.infer<typeof tutorSearchQuerySchema>;
