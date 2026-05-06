import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const clientUrlSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .every((origin) => z.string().url().safeParse(origin).success),
    "CLIENT_URL must contain one or more valid URLs separated by commas."
  );

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_SECRET: z.string().min(10).default("change-me-refresh-secret"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  AUTH_COOKIE_NAME: z.string().min(1).default("comlab_access_token"),
  AUTH_COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(86_400_000),
  REFRESH_COOKIE_NAME: z.string().min(1).default("comlab_refresh_token"),
  REFRESH_COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(604_800_000),
  AUTH_COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).optional(),
  CLIENT_URL: clientUrlSchema,
  APP_BASE_URL: z.string().url().default("http://localhost:5173"),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  RESET_TOKEN_PREVIEW: z.coerce.boolean().optional(),
  ENABLE_DEMO_BOOTSTRAP: z.coerce.boolean().optional(),
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.coerce.boolean().optional(),
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().min(1).optional(),
  NOTIFICATION_EMAIL_PREVIEW: z.coerce.boolean().optional(),
  RESERVATION_REMINDER_LEAD_MINUTES: z.coerce.number().int().positive().default(60),
  RESERVATION_REMINDER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  PASSWORD_RESET_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5)
});

const parsedEnv = envSchema.parse(process.env);

if (
  parsedEnv.NODE_ENV === "production" &&
  parsedEnv.JWT_REFRESH_SECRET === "change-me-refresh-secret"
) {
  throw new Error("JWT_REFRESH_SECRET must be explicitly set in production.");
}

const resolvedSameSite =
  parsedEnv.AUTH_COOKIE_SAME_SITE ?? (parsedEnv.NODE_ENV === "production" ? "none" : "lax");

export const env = {
  ...parsedEnv,
  AUTH_COOKIE_SAME_SITE: resolvedSameSite,
  RESET_TOKEN_PREVIEW: parsedEnv.RESET_TOKEN_PREVIEW ?? parsedEnv.NODE_ENV !== "production",
  ENABLE_DEMO_BOOTSTRAP: parsedEnv.ENABLE_DEMO_BOOTSTRAP ?? false,
  NOTIFICATION_EMAIL_PREVIEW:
    parsedEnv.NOTIFICATION_EMAIL_PREVIEW ??
    (!parsedEnv.SMTP_HOST || parsedEnv.NODE_ENV !== "production")
};
