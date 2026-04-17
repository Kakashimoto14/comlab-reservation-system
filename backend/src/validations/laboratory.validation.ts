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
  capacity: z.coerce.number().int().positive(),
  computerCount: z.coerce.number().int().positive(),
  description: z.string().min(10),
  status: z.nativeEnum(LaboratoryStatus),
  imageUrl: optionalImageSchema
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
