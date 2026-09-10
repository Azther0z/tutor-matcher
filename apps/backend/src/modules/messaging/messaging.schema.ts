import { z } from "zod";

export const sendMessageSchema = z.object({
  toUserId: z.number().int().positive(),
  message: z.string().trim().min(1).max(2000),
});

export type SendMessageRequest = z.infer<typeof sendMessageSchema>;
