import { z } from "zod";

import {
  emailSchema,
  passwordSchema,
  requiredDepartmentSchema,
  requiredNameSchema,
  requiredPhoneSchema,
  requiredStudentNumberSchema,
  yearLevelSchema
} from "./userRules.js";

export const registerStudentSchema = z.object({
  body: z.object({
    firstName: requiredNameSchema("First name"),
    lastName: requiredNameSchema("Last name"),
    email: emailSchema,
    password: passwordSchema,
    studentNumber: requiredStudentNumberSchema,
    department: requiredDepartmentSchema,
    yearLevel: yearLevelSchema,
    phone: requiredPhoneSchema
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const loginSchema = z.object({
  body: z.object({
    email: emailSchema,
    password: z.string().min(1, "Password is required.")
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: emailSchema
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(20)
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: emailSchema
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20),
    newPassword: passwordSchema
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
