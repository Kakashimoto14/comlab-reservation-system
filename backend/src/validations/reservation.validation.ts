import { z } from "zod";

const timeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/, "Time must use the HH:MM format.");

export const createReservationSchema = z.object({
  body: z
    .object({
      userId: z.coerce.number().int().positive().optional(),
      scheduleId: z.coerce.number().int().positive(),
      laboratoryId: z.coerce.number().int().positive(),
      reservationType: z.enum(["LAB", "PC"]).default("LAB"),
      pcId: z.coerce.number().int().positive().nullable().optional(),
      purpose: z.string().trim().min(10, "Purpose must be at least 10 characters long."),
      startTime: timeSchema,
      endTime: timeSchema
    })
    .superRefine((body, ctx) => {
      if (body.endTime <= body.startTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "End time must be later than start time."
        });
      }

      if (body.reservationType === "PC" && !body.pcId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pcId"],
          message: "PC reservations require a valid pcId."
        });
      }
    }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const reservationIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const reviewReservationSchema = z.object({
  body: z.object({
    status: z.enum(["APPROVED", "REJECTED"]),
    remarks: z.string().max(255).optional()
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const completeReservationSchema = z.object({
  body: z.object({
    remarks: z.string().max(255).optional()
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});
