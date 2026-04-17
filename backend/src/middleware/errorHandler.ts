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

  return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    message: "An unexpected server error occurred."
  });
};
