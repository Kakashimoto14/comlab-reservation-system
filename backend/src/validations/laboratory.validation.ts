import { LaboratoryStatus } from "@prisma/client";
import { z } from "zod";

export const laboratoryBodySchema = z.object({
  name: z.string().min(3),
  roomCode: z.string().min(3),
  building: z.string().min(3),
  capacity: z.coerce.number().int().positive(),
  computerCount: z.coerce.number().int().positive(),
  description: z.string().min(10),
  status: z.nativeEnum(LaboratoryStatus),
  imageUrl: z.string().url().optional().or(z.literal(""))
});

export const createLaboratorySchema = z.object({
  body: laboratoryBodySchema,
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const updateLaboratorySchema = z.object({
  body: laboratoryBodySchema,
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const laboratoryIdSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});
