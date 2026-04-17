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
  CLIENT_URL: clientUrlSchema
});

export const env = envSchema.parse(process.env);
