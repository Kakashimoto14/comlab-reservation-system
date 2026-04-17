import { z } from "zod";

export const createReservationSchema = z.object({
  body: z.object({
    scheduleId: z.coerce.number().int().positive(),
    laboratoryId: z.coerce.number().int().positive(),
    purpose: z.string().min(10),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/)
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
