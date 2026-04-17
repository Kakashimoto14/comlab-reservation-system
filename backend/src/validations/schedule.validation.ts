import { ScheduleStatus } from "@prisma/client";
import { z } from "zod";

export const scheduleBodySchema = z.object({
  laboratoryId: z.coerce.number().int().positive(),
  date: z.string().date(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  status: z.nativeEnum(ScheduleStatus)
});

export const createScheduleSchema = z.object({
  body: scheduleBodySchema,
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const updateScheduleSchema = z.object({
  body: scheduleBodySchema,
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const listScheduleSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    laboratoryId: z.coerce.number().int().positive().optional(),
    date: z.string().date().optional()
  })
});

export const scheduleIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});
