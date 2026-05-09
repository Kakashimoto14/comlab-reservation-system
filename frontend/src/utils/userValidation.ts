import { z } from "zod";

import type { UserRole } from "../types/api";

export const NAME_PATTERN = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
export const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{5}$/;
export const PHONE_PATTERN = /^(?:\+639|09)\d{9}$/;
export const YEAR_LEVEL_OPTIONS = ["1", "2", "3", "4"] as const;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const normalizeEmail = (value: string) => collapseWhitespace(value).toLowerCase();

export const normalizeName = (value: string) =>
  collapseWhitespace(value).replace(/\s*-\s*/g, "-");

export const normalizePlainText = (value: string) => collapseWhitespace(value);

export const normalizeOptionalText = (value: string) => {
  const normalizedValue = normalizePlainText(value);
  return normalizedValue === "" ? undefined : normalizedValue;
};

export const sanitizeNameInput = (value: string) =>
  value
    .replace(/[^A-Za-z -]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*-\s*/g, "-")
    .replace(/^[ -]+/, "");

const digitsBeforeCursor = (value: string, cursor: number) =>
  value.slice(0, cursor).replace(/\D/g, "").length;

const cursorForDigitCount = (value: string, digitCount: number) => {
  if (digitCount <= 0) {
    return 0;
  }

  let seenDigits = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      seenDigits += 1;
    }

    if (seenDigits >= digitCount) {
      return index + 1;
    }
  }

  return value.length;
};

export const formatStudentNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 7);

  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
};

export const getFormattedStudentNumberInput = (value: string, cursor: number) => {
  const formattedValue = formatStudentNumber(value);
  const nextCursor = cursorForDigitCount(formattedValue, digitsBeforeCursor(value, cursor));

  return {
    value: formattedValue,
    cursor: nextCursor
  };
};

export const sanitizePhoneInput = (value: string) => {
  if (!value.trim()) {
    return "";
  }

  const digits = value.replace(/\D/g, "");
  return value.trim().startsWith("+") ? `+${digits.slice(0, 12)}` : digits.slice(0, 11);
};

const preprocessRequired =
  (normalizer: (value: string) => string) =>
  (value: unknown) =>
    typeof value === "string" ? normalizer(value) : value;

const preprocessOptional =
  (normalizer: (value: string) => string) =>
  (value: unknown) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalizedValue = normalizer(value);
    return normalizedValue === "" ? undefined : normalizedValue;
  };

export const requiredNameSchema = (label: string) =>
  z.preprocess(
    preprocessRequired(normalizeName),
    z
      .string({ required_error: `${label} is required.` })
      .min(2, `${label} must be at least 2 characters.`)
      .max(50, `${label} must be 50 characters or fewer.`)
      .regex(NAME_PATTERN, `${label} can only contain letters, spaces, and hyphens.`)
  );

export const emailSchema = z.preprocess(
  preprocessRequired(normalizeEmail),
  z
    .string({ required_error: "Email is required." })
    .email("Enter a valid email address.")
    .max(191, "Email must be 191 characters or fewer.")
);

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/\d/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character.");

export const departmentSchema = z.preprocess(
  preprocessRequired(normalizePlainText),
  z
    .string({ required_error: "Department is required." })
    .min(2, "Department must be at least 2 characters.")
    .max(120, "Department must be 120 characters or fewer.")
);

export const optionalDepartmentSchema = z.preprocess(
  preprocessOptional(normalizePlainText),
  z
    .string()
    .min(2, "Department must be at least 2 characters.")
    .max(120, "Department must be 120 characters or fewer.")
    .optional()
);

export const studentNumberSchema = z.preprocess(
  preprocessRequired(formatStudentNumber),
  z
    .string({ required_error: "Student number is required." })
    .regex(STUDENT_NUMBER_PATTERN, "Student number must use the format 12-34567.")
);

export const optionalStudentNumberSchema = z.preprocess(
  preprocessOptional(formatStudentNumber),
  z
    .string()
    .regex(STUDENT_NUMBER_PATTERN, "Student number must use the format 12-34567.")
    .optional()
);

export const phoneSchema = z.preprocess(
  preprocessRequired(sanitizePhoneInput),
  z
    .string({ required_error: "Phone number is required." })
    .regex(PHONE_PATTERN, "Phone number must start with 09 or +639 and contain 11 to 13 characters.")
);

export const optionalPhoneSchema = z.preprocess(
  preprocessOptional(sanitizePhoneInput),
  z
    .string()
    .regex(PHONE_PATTERN, "Phone number must start with 09 or +639 and contain 11 to 13 characters.")
    .optional()
);

export const yearLevelSchema = z.preprocess(
  (value) =>
    value === "" || value === null || typeof value === "undefined" ? undefined : value,
  z.enum(YEAR_LEVEL_OPTIONS, {
    required_error: "Year level is required."
  })
);

export const optionalYearLevelSchema = z.preprocess(
  (value) =>
    value === "" || value === null || typeof value === "undefined" ? undefined : value,
  z.enum(YEAR_LEVEL_OPTIONS).optional()
);

export const roleSchema = z.enum(["ADMIN", "STUDENT", "LABORATORY_STAFF"]);

type StudentRoleFields = {
  role: UserRole;
  studentNumber?: string;
  yearLevel?: string;
};

type YearLevelRoleFields = {
  role: UserRole;
  yearLevel?: string;
};

export const validateStudentFieldsForRole = (
  values: StudentRoleFields,
  context: z.RefinementCtx
) => {
  if (values.role === "STUDENT") {
    if (!values.studentNumber) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Student number is required for student accounts.",
        path: ["studentNumber"]
      });
    }

    if (!values.yearLevel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Year level is required for student accounts.",
        path: ["yearLevel"]
      });
    }

    return;
  }

  if (values.studentNumber) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only student accounts can store a student number.",
      path: ["studentNumber"]
    });
  }

  if (values.yearLevel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only student accounts can store a year level.",
      path: ["yearLevel"]
    });
  }
};

export const validateYearLevelForRole = (
  values: YearLevelRoleFields,
  context: z.RefinementCtx
) => {
  if (values.role === "STUDENT") {
    if (!values.yearLevel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Year level is required for student accounts.",
        path: ["yearLevel"]
      });
    }

    return;
  }

  if (values.yearLevel) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only student accounts can store a year level.",
      path: ["yearLevel"]
    });
  }
};

const optionalPasswordSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmedValue = value.trim();
    return trimmedValue === "" ? undefined : trimmedValue;
  },
  passwordSchema.optional()
);

export const buildStudentRegistrationSchema = () =>
  z.object({
    firstName: requiredNameSchema("First name"),
    lastName: requiredNameSchema("Last name"),
    email: emailSchema,
    password: passwordSchema,
    studentNumber: studentNumberSchema,
    department: departmentSchema,
    yearLevel: yearLevelSchema,
    phone: phoneSchema
  });

export const buildManagedUserSchema = () =>
  z
    .object({
      firstName: requiredNameSchema("First name"),
      lastName: requiredNameSchema("Last name"),
      email: emailSchema,
      password: optionalPasswordSchema,
      role: roleSchema,
      studentNumber: optionalStudentNumberSchema,
      department: optionalDepartmentSchema,
      yearLevel: optionalYearLevelSchema,
      phone: optionalPhoneSchema
    })
    .superRefine(validateStudentFieldsForRole);

export const buildProfileSchema = (role?: UserRole) =>
  z
    .object({
      firstName: requiredNameSchema("First name"),
      lastName: requiredNameSchema("Last name"),
      department: optionalDepartmentSchema,
      yearLevel: optionalYearLevelSchema,
      phone: optionalPhoneSchema
    })
    .superRefine((values, context) => {
      if (!role) {
        return;
      }

      validateYearLevelForRole(
        {
          role,
          yearLevel: values.yearLevel
        },
        context
      );
    });

export const normalizeUserDisplayName = (firstName?: string | null, lastName?: string | null) =>
  [firstName, lastName].filter(Boolean).join(" ");
