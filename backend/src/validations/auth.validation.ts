import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/\d/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

export const registerStudentSchema = z.object({
  body: z.object({
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: passwordSchema,
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
    password: z.string().min(1, "Password is required.")
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().email()
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    password: passwordSchema
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
