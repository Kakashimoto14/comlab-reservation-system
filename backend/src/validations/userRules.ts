import { UserRole } from "@prisma/client";
import { z } from "zod";

export const NAME_PATTERN = /^[A-Za-z]+(?:[ -][A-Za-z]+)*$/;
export const STUDENT_NUMBER_PATTERN = /^\d{2}-\d{5}$/;
export const PHONE_PATTERN = /^(?:\+639|09)\d{9}$/;
export const YEAR_LEVEL_VALUES = [1, 2, 3, 4] as const;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, " ").trim();

export const normalizeEmail = (value: string) => collapseWhitespace(value).toLowerCase();

export const normalizeName = (value: string) =>
  collapseWhitespace(value).replace(/\s*-\s*/g, "-");

export const normalizePlainText = (value: string) => collapseWhitespace(value);

export const normalizeStudentNumber = (value: string) =>
  collapseWhitespace(value).replace(/\s*-\s*/g, "-");

export const normalizePhone = (value: string) => {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return "";
  }

  if (/[A-Za-z]/.test(trimmedValue)) {
    return trimmedValue;
  }

  const digits = trimmedValue.replace(/\D/g, "");
  return trimmedValue.startsWith("+") ? `+${digits}` : digits;
};

const preprocessRequiredString =
  (normalizer: (value: string) => string) =>
  (value: unknown) =>
    typeof value === "string" ? normalizer(value) : value;

const preprocessOptionalString =
  (normalizer: (value: string) => string) =>
  (value: unknown) => {
    if (value === null) {
      return null;
    }

    if (typeof value !== "string") {
      return value;
    }

    const normalizedValue = normalizer(value);
    return normalizedValue === "" ? null : normalizedValue;
  };

export const requiredNameSchema = (label: string) =>
  z.preprocess(
    preprocessRequiredString(normalizeName),
    z
      .string({ required_error: `${label} is required.` })
      .min(2, `${label} must be at least 2 characters.`)
      .max(50, `${label} must be 50 characters or fewer.`)
      .regex(NAME_PATTERN, `${label} can only contain letters, spaces, and hyphens.`)
  );

export const emailSchema = z.preprocess(
  preprocessRequiredString(normalizeEmail),
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

export const requiredStudentNumberSchema = z.preprocess(
  preprocessRequiredString(normalizeStudentNumber),
  z
    .string({ required_error: "Student number is required." })
    .regex(STUDENT_NUMBER_PATTERN, "Student number must use the format 12-34567.")
);

export const optionalStudentNumberSchema = z.preprocess(
  preprocessOptionalString(normalizeStudentNumber),
  z
    .string()
    .regex(STUDENT_NUMBER_PATTERN, "Student number must use the format 12-34567.")
    .nullish()
);

export const requiredDepartmentSchema = z.preprocess(
  preprocessRequiredString(normalizePlainText),
  z
    .string({ required_error: "Department is required." })
    .min(2, "Department must be at least 2 characters.")
    .max(120, "Department must be 120 characters or fewer.")
);

export const optionalDepartmentSchema = z.preprocess(
  preprocessOptionalString(normalizePlainText),
  z
    .string()
    .min(2, "Department must be at least 2 characters.")
    .max(120, "Department must be 120 characters or fewer.")
    .nullish()
);

export const requiredPhoneSchema = z.preprocess(
  preprocessRequiredString(normalizePhone),
  z
    .string({ required_error: "Phone number is required." })
    .regex(PHONE_PATTERN, "Phone number must start with 09 or +639 and contain 11 to 13 characters.")
);

export const optionalPhoneSchema = z.preprocess(
  preprocessOptionalString(normalizePhone),
  z
    .string()
    .regex(PHONE_PATTERN, "Phone number must start with 09 or +639 and contain 11 to 13 characters.")
    .nullish()
);

export const yearLevelSchema = z.preprocess(
  (value) =>
    value === "" || value === null || typeof value === "undefined" ? undefined : value,
  z
    .coerce.number({
      invalid_type_error: "Year level is required."
    })
    .int("Year level must be a whole number.")
    .refine(
      (value) => YEAR_LEVEL_VALUES.includes(value as (typeof YEAR_LEVEL_VALUES)[number]),
      "Year level must be 1, 2, 3, or 4."
    )
);

export const optionalYearLevelSchema = z.preprocess(
  (value) =>
    value === "" || value === null || typeof value === "undefined" ? null : value,
  z
    .coerce.number()
    .int("Year level must be a whole number.")
    .refine(
      (value) => YEAR_LEVEL_VALUES.includes(value as (typeof YEAR_LEVEL_VALUES)[number]),
      "Year level must be 1, 2, 3, or 4."
    )
    .nullish()
);

type StudentFieldCarrier = {
  role?: UserRole;
  studentNumber?: string | null;
  yearLevel?: number | null;
};

export const validateStudentFieldsForRole = (
  value: StudentFieldCarrier,
  context: z.RefinementCtx
) => {
  if (value.role === UserRole.STUDENT) {
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

    return;
  }

  if (value.studentNumber !== undefined && value.studentNumber !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only student accounts can store a student number.",
      path: ["studentNumber"]
    });
  }

  if (value.yearLevel !== undefined && value.yearLevel !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Only student accounts can store a year level.",
      path: ["yearLevel"]
    });
  }
};
