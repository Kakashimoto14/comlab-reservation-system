import type { NextFunction, Request, Response } from "express";
import type { AnyZodObject } from "zod";

const sanitizeValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<Record<string, unknown>>(
      (accumulator, [key, nestedValue]) => {
        if (key === "__proto__" || key === "constructor" || key === "prototype") {
          return accumulator;
        }

        accumulator[key] = sanitizeValue(nestedValue);
        return accumulator;
      },
      {}
    );
  }

  return value;
};

export const validate =
  (schema: AnyZodObject) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse({
      body: sanitizeValue(req.body),
      params: sanitizeValue(req.params),
      query: sanitizeValue(req.query)
    });

    if (!result.success) {
      return next(result.error);
    }

    req.body = result.data.body;
    req.params = result.data.params;
    req.query = result.data.query;

    return next();
  };
