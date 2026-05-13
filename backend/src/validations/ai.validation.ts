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
