import { StatusCodes } from "http-status-codes";
import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/ApiError.js";
import { verifyToken } from "../utils/jwt.js";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required."));
  }

  try {
    const payload = verifyToken(header.replace("Bearer ", ""));

    req.authUser = {
      id: payload.id,
      email: payload.email,
      role: payload.role as NonNullable<Request["authUser"]>["role"]
    };

    return next();
  } catch (_error) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Invalid or expired token."));
  }
};

export const optionalAuthenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    return next();
  }

  try {
    const payload = verifyToken(header.replace("Bearer ", ""));

    req.authUser = {
      id: payload.id,
      email: payload.email,
      role: payload.role as NonNullable<Request["authUser"]>["role"]
    };
  } catch (_error) {
    req.authUser = undefined;
  }

  return next();
};
