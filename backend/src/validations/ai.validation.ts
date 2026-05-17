import { z } from "zod";

export const reservationAssistantSchema = z.object({
  body: z.object({
    message: z
      .string({ required_error: "Message is required." })
      .trim()
      .min(1, "Message is required.")
      .max(1000, "Message must be 1000 characters or fewer.")
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const assistantActionIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    actionId: z.string().uuid()
  }),
  query: z.object({}).default({})
});

export const confirmAssistantActionSchema = z.object({
  body: z.object({
    confirmation: z.string().trim().min(1).max(100).optional()
  }),
  params: z.object({
    actionId: z.string().uuid()
  }),
  query: z.object({}).default({})
});
