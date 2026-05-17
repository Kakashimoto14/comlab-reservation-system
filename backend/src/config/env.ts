import dotenv from "dotenv";
import { z } from "zod";

import { parseBooleanEnvValue } from "../utils/envBoolean.js";

dotenv.config();

const singleUrlSchema = z.string().url();
const optionalUrlSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().url().optional()
);
const optionalNonEmptyStringSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional()
);
const optionalAiProviderSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.enum(["groq", "openrouter", "openai", "custom"]).optional()
);

const booleanEnvSchema = z.preprocess(parseBooleanEnvValue, z.boolean().optional());
const DEFAULT_LOCALHOST_ORIGINS = [
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174"
] as const;
const DEFAULT_PRODUCTION_ORIGINS = [
  "https://www.comlabreservation.app",
  "https://comlabreservation.app"
] as const;

const corsOriginsSchema = z
  .string()
  .min(1)
  .refine(
    (value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean)
        .every((origin) => singleUrlSchema.safeParse(origin).success),
    "CORS_ORIGINS must contain one or more valid URLs separated by commas."
  );

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optionalNonEmptyStringSchema,
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default("1d"),
  JWT_REFRESH_SECRET: z.string().min(10).default("change-me-refresh-secret"),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  AUTH_COOKIE_NAME: z.string().min(1).default("comlab_access_token"),
  AUTH_COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(86_400_000),
  REFRESH_COOKIE_NAME: z.string().min(1).default("comlab_refresh_token"),
  REFRESH_COOKIE_MAX_AGE_MS: z.coerce.number().int().positive().default(604_800_000),
  AUTH_COOKIE_SAME_SITE: z.enum(["strict", "lax", "none"]).optional(),
  CLIENT_URL: optionalUrlSchema,
  FRONTEND_URL: optionalUrlSchema,
  APP_BASE_URL: optionalUrlSchema,
  CORS_ORIGINS: corsOriginsSchema.optional(),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  EMAIL_VERIFICATION_TOKEN_TTL_HOURS: z.coerce.number().int().positive().default(24),
  RESET_TOKEN_PREVIEW: booleanEnvSchema,
  ENABLE_DEMO_BOOTSTRAP: booleanEnvSchema,
  ENABLE_BACKGROUND_WORKERS: booleanEnvSchema,
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: booleanEnvSchema,
  SMTP_USER: z.string().min(1).optional(),
  SMTP_PASS: z.string().min(1).optional(),
  SMTP_FROM: z.string().min(1).optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().min(1).optional(),
  NOTIFICATION_EMAIL_PREVIEW: booleanEnvSchema,
  AI_PROVIDER: optionalAiProviderSchema,
  AI_API_KEY: optionalNonEmptyStringSchema,
  AI_MODEL: optionalNonEmptyStringSchema,
  AI_API_BASE_URL: optionalUrlSchema,
  OPENROUTER_SITE_URL: optionalUrlSchema,
  OPENROUTER_APP_NAME: z.string().min(1).optional(),
  RESERVATION_REMINDER_LEAD_MINUTES: z.coerce.number().int().positive().default(60),
  RESERVATION_REMINDER_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  FORGOT_PASSWORD_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  FORGOT_PASSWORD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  RESET_PASSWORD_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RESET_PASSWORD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  VERIFY_EMAIL_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  VERIFY_EMAIL_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  RESEND_VERIFICATION_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RESEND_VERIFICATION_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  AI_ASSISTANT_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  AI_ASSISTANT_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(12)
});

const parsedEnv = envSchema.parse(process.env);
const looksLikePlaceholderSecret = (value: string) =>
  ["replace_me_", "change-me", "your_", "example"].some((fragment) =>
    value.toLowerCase().includes(fragment)
  );

if (
  parsedEnv.NODE_ENV === "production" &&
  (looksLikePlaceholderSecret(parsedEnv.JWT_SECRET) ||
    looksLikePlaceholderSecret(parsedEnv.JWT_REFRESH_SECRET))
) {
  throw new Error(
    "JWT_SECRET and JWT_REFRESH_SECRET must be explicitly set to real secure values in production."
  );
}

if (
  parsedEnv.NODE_ENV === "production" &&
  !parsedEnv.FRONTEND_URL &&
  !parsedEnv.APP_BASE_URL
) {
  throw new Error("FRONTEND_URL or APP_BASE_URL must be explicitly set in production.");
}

const resolvedSameSite =
  parsedEnv.AUTH_COOKIE_SAME_SITE ?? (parsedEnv.NODE_ENV === "production" ? "none" : "lax");
const resolvedFrontendUrl = parsedEnv.FRONTEND_URL ?? parsedEnv.APP_BASE_URL ?? "http://localhost:5173";
const resolvedClientUrl = parsedEnv.CLIENT_URL ?? resolvedFrontendUrl;
const configuredCorsOrigins = (parsedEnv.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const resolvedCorsOriginsList = Array.from(
  new Set([
    ...DEFAULT_PRODUCTION_ORIGINS,
    ...(parsedEnv.NODE_ENV === "production" ? [] : DEFAULT_LOCALHOST_ORIGINS),
    resolvedClientUrl,
    resolvedFrontendUrl,
    parsedEnv.APP_BASE_URL ?? "",
    ...configuredCorsOrigins
  ].filter(Boolean))
);
const resolvedCorsOrigins = corsOriginsSchema.parse(resolvedCorsOriginsList.join(","));
const hasSmtpSender = Boolean(parsedEnv.SMTP_FROM || parsedEnv.SMTP_FROM_EMAIL);
const hasSmtpConfig = Boolean(
  parsedEnv.SMTP_HOST && parsedEnv.SMTP_PORT && hasSmtpSender
);

export const env = {
  ...parsedEnv,
  CLIENT_URL: resolvedClientUrl,
  CORS_ORIGINS: resolvedCorsOrigins,
  FRONTEND_URL: resolvedFrontendUrl,
  APP_BASE_URL: parsedEnv.APP_BASE_URL ?? resolvedFrontendUrl,
  DIRECT_URL: parsedEnv.DIRECT_URL ?? parsedEnv.DATABASE_URL,
  AUTH_COOKIE_SAME_SITE: resolvedSameSite,
  RESET_TOKEN_PREVIEW: parsedEnv.RESET_TOKEN_PREVIEW ?? parsedEnv.NODE_ENV !== "production",
  ENABLE_DEMO_BOOTSTRAP: parsedEnv.ENABLE_DEMO_BOOTSTRAP ?? false,
  ENABLE_BACKGROUND_WORKERS: parsedEnv.ENABLE_BACKGROUND_WORKERS ?? true,
  NOTIFICATION_EMAIL_PREVIEW:
    parsedEnv.NOTIFICATION_EMAIL_PREVIEW ??
    (!hasSmtpConfig || parsedEnv.NODE_ENV !== "production")
};
