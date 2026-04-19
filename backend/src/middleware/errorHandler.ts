import type { NextFunction, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
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
      message: error.message
    });
  }

  if (error instanceof ZodError) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Validation failed.",
      errors: error.flatten()
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
