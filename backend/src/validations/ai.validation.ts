import { z } from "zod";

export const reservationAssistantSchema = z.object({
  body: z.object({
    message: z
      .string({ required_error: "Message is required." })
      .trim()
      .min(3, "Message must be at least 3 characters.")
      .max(1000, "Message must be 1000 characters or fewer.")
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
