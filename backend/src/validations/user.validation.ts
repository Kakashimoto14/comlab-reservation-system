import { UserRole, UserStatus } from "@prisma/client";
import { z } from "zod";

const optionalTrimmedString = (schema: z.ZodTypeAny) =>
  z.preprocess((value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  }, schema.optional());

const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/\d/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

const optionalPassword = optionalTrimmedString(passwordSchema);
const optionalStudentNumber = optionalTrimmedString(z.string().min(6));
const optionalDepartment = optionalTrimmedString(z.string().min(2));
const optionalPhone = optionalTrimmedString(z.string().min(7));
const optionalYearLevel = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(1).max(6).optional()
);

const requireStudentFields = (
  value: { role?: UserRole; studentNumber?: string; yearLevel?: number },
  context: z.RefinementCtx
) => {
  if (value.role !== UserRole.STUDENT) {
    return;
  }

  if (!value.studentNumber) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Student number is required for student accounts.",
      path: ["studentNumber"]
    });
  }

  if (typeof value.yearLevel !== "number" || Number.isNaN(value.yearLevel)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Year level is required for student accounts.",
      path: ["yearLevel"]
    });
  }
};

export const createUserSchema = z.object({
  body: z
    .object({
      firstName: z.string().min(2),
      lastName: z.string().min(2),
      email: z.string().email(),
      password: passwordSchema,
      role: z.nativeEnum(UserRole),
      studentNumber: optionalStudentNumber,
      department: optionalDepartment,
      yearLevel: optionalYearLevel,
      phone: optionalPhone
    })
    .superRefine(requireStudentFields),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});

export const updateUserSchema = z.object({
  body: z
    .object({
      firstName: z.string().min(2).optional(),
      lastName: z.string().min(2).optional(),
      email: z.string().email().optional(),
      password: optionalPassword,
      role: z.nativeEnum(UserRole).optional(),
      studentNumber: optionalStudentNumber,
      department: optionalDepartment,
      yearLevel: optionalYearLevel,
      phone: optionalPhone,
      status: z.nativeEnum(UserStatus).optional()
    })
    .superRefine(requireStudentFields),
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
    department: optionalDepartment,
    yearLevel: optionalYearLevel,
    phone: optionalPhone
  }),
  params: z.object({}).default({}),
  query: z.object({}).default({})
});
