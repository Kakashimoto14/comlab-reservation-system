import { LaboratoryStatus } from "@prisma/client";
import { z } from "zod";

const imageValueSchema = z
  .string()
  .trim()
  .refine(
    (value) =>
      value.startsWith("http://") ||
      value.startsWith("https://") ||
      /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(value),
    "Provide a valid image link or upload a PNG, JPG, WEBP, or GIF image."
  );

const optionalImageSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  imageValueSchema.optional()
);

export const laboratoryBodySchema = z.object({
  name: z.string().min(3),
  roomCode: z.string().min(3),
  building: z.string().min(3),
  location: z.string().min(3).optional(),
  capacity: z.coerce.number().int().positive(),
  computerCount: z.coerce.number().int().positive(),
  description: z.string().min(10),
  status: z.nativeEnum(LaboratoryStatus),
  imageUrl: optionalImageSchema,
  custodianId: z.coerce.number().int().positive().nullable().optional()
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

export const assignLaboratoryStaffSchema = z.object({
  body: z.object({
    custodianId: z.coerce.number().int().positive().nullable()
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const listLaboratoryAssignmentsSchema = z.object({
  body: z.object({}).default({}),
  params: z.object({}).default({}),
  query: z.object({
    building: z.string().optional(),
    department: z.string().optional()
  })
});

export const updatePcStatusSchema = z.object({
  body: z.object({
    status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"])
  }),
  params: z.object({
    id: z.coerce.number().int().positive(),
    pcId: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const updateMyLabPcStatusSchema = z.object({
  body: z.object({
    status: z.enum(["AVAILABLE", "OCCUPIED", "MAINTENANCE"])
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});
