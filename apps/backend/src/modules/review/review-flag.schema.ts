import { z } from "zod";

export const reviewFlagParamsSchema = z.object({ id: z.uuid() });
// REV-3: the member says why the comment is inappropriate so an Admin can decide.
export const reviewFlagSchema = z.object({ reason: z.string().trim().min(1).max(500) });
export type ReviewFlagInput = z.infer<typeof reviewFlagSchema>;
