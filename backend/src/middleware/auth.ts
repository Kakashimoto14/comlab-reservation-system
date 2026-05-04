import { StatusCodes } from "http-status-codes";
import type { NextFunction, Request, Response } from "express";

import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

const extractToken = (req: Request) => {
  const header = req.headers.authorization;

  if (header?.startsWith("Bearer ")) {
    return header.replace("Bearer ", "");
  }

  const cookieToken = req.cookies?.[env.AUTH_COOKIE_NAME];

  if (typeof cookieToken === "string" && cookieToken) {
    return cookieToken;
  }

  return null;
};

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const token = extractToken(req);

  if (!token) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required."));
  }

  try {
    const payload = verifyAccessToken(token);

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
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);

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
