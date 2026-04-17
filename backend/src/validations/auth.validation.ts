import { z } from "zod";

export const registerStudentSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    studentNumber: z.string().min(6),
    department: z.string().min(2),
    yearLevel: z.coerce.number().min(1).max(6),
    phone: z.string().min(7).optional()
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
