import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

const optionalPassword = z.string().min(8).optional();

export const createUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    role: z.nativeEnum(UserRole),
    studentNumber: z.string().min(6).optional(),
    department: z.string().min(2).optional(),
    yearLevel: z.coerce.number().min(1).max(6).optional(),
    phone: z.string().min(7).optional()
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(2).optional(),
    lastName: z.string().min(2).optional(),
    email: z.string().email().optional(),
    password: optionalPassword,
    role: z.nativeEnum(UserRole).optional(),
    studentNumber: z.string().min(6).optional(),
    department: z.string().min(2).optional(),
    yearLevel: z.coerce.number().min(1).max(6).optional(),
    phone: z.string().min(7).optional(),
    status: z.nativeEnum(UserStatus).optional()
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.nativeEnum(UserStatus)
  }),
  params: z.object({
    id: z.coerce.number().int().positive()
  }),
  query: z.object({}).default({})
});

export const updateProfileSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    department: z.string().min(2).optional(),
    yearLevel: z.coerce.number().min(1).max(6).optional(),
    phone: z.string().min(7).optional()
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
