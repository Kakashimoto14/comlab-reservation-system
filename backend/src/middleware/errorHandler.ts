import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

import { ApiError } from "../utils/ApiError.js";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(StatusCodes.NOT_FOUND).json({
    message: "The requested resource was not found."
  });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({
      message: error.message,
      ...(error.errors ? { errors: error.errors } : {})
    });
  }

  if (error instanceof ZodError) {
    const errors = error.issues.reduce<Record<string, string[]>>((accumulator, issue) => {
      const path = issue.path.filter(
        (segment) => segment !== "body" && segment !== "params" && segment !== "query"
      );
      const key = path.length ? path.join(".") : "form";

      accumulator[key] ??= [];
      accumulator[key].push(issue.message);
      return accumulator;
    }, {});

    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Validation failed.",
      errors
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const targets = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [];
      const fieldErrors = targets.reduce<Record<string, string[]>>((accumulator, field) => {
        accumulator[field] = [`${field} already exists.`];
        return accumulator;
      }, {});

      return res.status(StatusCodes.CONFLICT).json({
        message: "A record with the same unique field already exists.",
        ...(targets.length ? { errors: fieldErrors } : {})
      });
    }

    if (error.code === "P2025") {
      return res.status(StatusCodes.NOT_FOUND).json({
        message: "The requested record no longer exists."
      });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Invalid request data."
    });
  }

  if (error instanceof SyntaxError && "body" in error) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Request body contains invalid JSON."
    });
  }

  if (error instanceof Error && error.message === "CORS blocked for this origin.") {
    return res.status(StatusCodes.FORBIDDEN).json({
      message:
        "This request origin is not allowed to access the ComLab Reservation System API."
    });
  }

  console.error("Unhandled server error", error);

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: "An unexpected server error occurred."
  });
};
