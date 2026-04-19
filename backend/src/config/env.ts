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
  CLIENT_URL: clientUrlSchema,
  APP_BASE_URL: z.string().url().default("http://localhost:5173"),
  RESET_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  RESET_TOKEN_PREVIEW: z.coerce.boolean().optional(),
  ENABLE_DEMO_BOOTSTRAP: z.coerce.boolean().optional(),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  REGISTER_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5),
  PASSWORD_RESET_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  PASSWORD_RESET_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(5)
});

const parsedEnv = envSchema.parse(process.env);

export const env = {
  ...parsedEnv,
  RESET_TOKEN_PREVIEW: parsedEnv.RESET_TOKEN_PREVIEW ?? parsedEnv.NODE_ENV !== "production",
  ENABLE_DEMO_BOOTSTRAP:
    parsedEnv.ENABLE_DEMO_BOOTSTRAP ?? parsedEnv.NODE_ENV !== "production"
};
