import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

import {
  emailSchema,
  optionalDepartmentSchema,
  optionalPhoneSchema,
  optionalStudentNumberSchema,
  optionalYearLevelSchema,
  passwordSchema,
  requiredNameSchema,
  validateStudentFieldsForRole
} from "./userRules.js";

const optionalPassword = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  },
  passwordSchema.optional()
);

export const createUserSchema = z.object({
  body: z
    .object({
      firstName: requiredNameSchema("First name"),
      lastName: requiredNameSchema("Last name"),
      email: emailSchema,
      password: passwordSchema,
      role: z.nativeEnum(UserRole),
      studentNumber: optionalStudentNumberSchema,
      department: optionalDepartmentSchema,
      yearLevel: optionalYearLevelSchema,
      phone: optionalPhoneSchema
    })
    .superRefine(validateStudentFieldsForRole),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const updateUserSchema = z.object({
  body: z
    .object({
      firstName: requiredNameSchema("First name").optional(),
      lastName: requiredNameSchema("Last name").optional(),
      email: emailSchema.optional(),
      password: optionalPassword,
      role: z.nativeEnum(UserRole).optional(),
      studentNumber: optionalStudentNumberSchema,
      department: optionalDepartmentSchema,
      yearLevel: optionalYearLevelSchema,
      phone: optionalPhoneSchema,
      status: z.nativeEnum(UserStatus).optional()
    })
    .superRefine((value, context) => {
      if (typeof value.role === "undefined") {
        return;
      }

      validateStudentFieldsForRole(value, context);
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
    firstName: requiredNameSchema("First name"),
    lastName: requiredNameSchema("Last name"),
    department: optionalDepartmentSchema,
    yearLevel: optionalYearLevelSchema,
    phone: optionalPhoneSchema
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
