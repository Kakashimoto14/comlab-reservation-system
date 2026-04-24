import { CalendarEventType } from "@prisma/client";
import { z } from "zod";

const calendarEventBodySchema = z.object({
  title: z.string().min(3),
  type: z.nativeEnum(CalendarEventType),
  laboratoryId: z.coerce.number().int().positive().nullable().optional(),
  pcId: z.coerce.number().int().positive().nullable().optional(),
  date: z.string().date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  description: z.string().max(255).nullable().optional()
});

export const listCalendarSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    laboratoryId: z.coerce.number().int().positive().optional(),
    date: z.string().date().optional()
  })
});

export const createCalendarEventSchema = z.object({
  body: calendarEventBodySchema,
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const updateCalendarEventSchema = z.object({
  body: calendarEventBodySchema,
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const calendarEventIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});
