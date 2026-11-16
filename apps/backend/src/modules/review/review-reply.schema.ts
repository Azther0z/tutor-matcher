import { z } from "zod";

export const reviewReplyParamsSchema = z.object({ id: z.uuid() });
export const reviewReplySchema = z.object({ text: z.string().trim().min(1).max(2000) });
export type ReviewReplyInput = z.infer<typeof reviewReplySchema>;
export const reviewReplyEditSchema = reviewReplySchema.extend({
  expectedUpdatedAt: z.iso.datetime(),
});
export type ReviewReplyEditInput = z.infer<typeof reviewReplyEditSchema>;
