import { StatusCodes } from "http-status-codes";
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";
import { verifyAccessToken } from "../utils/jwt.js";

const authSessionSelect = {
  id: true,
  userId: true,
  expiresAt: true,
  revokedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      role: true,
      status: true
    }
  }
} as const;

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

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required."));
  }

  try {
    const payload = verifyAccessToken(token);

    if (!Number.isInteger(payload.sid)) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid or expired token.");
    }

    const session = await prisma.authSession.findUnique({
      where: { id: payload.sid },
      select: authSessionSelect
    });

    if (
      !session ||
      session.userId !== payload.id ||
      session.revokedAt !== null ||
      session.expiresAt <= new Date() ||
      session.user.status !== "ACTIVE" ||
      !session.user.emailVerifiedAt
    ) {
      if (session?.revokedAt === null) {
        await prisma.authSession.updateMany({
          where: { id: session.id, revokedAt: null },
          data: { revokedAt: new Date() }
        });
      }

      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid or expired token.");
    }

    req.authUser = {
      id: session.user.id,
      sessionId: session.id,
      email: session.user.email,
      role: session.user.role
    };

    return next();
  } catch (_error) {
    return next(new ApiError(StatusCodes.UNAUTHORIZED, "Invalid or expired token."));
  }
};

export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const token = extractToken(req);

  if (!token) {
    return next();
  }

  try {
    const payload = verifyAccessToken(token);

    if (!Number.isInteger(payload.sid)) {
      req.authUser = undefined;
      return next();
    }

    const session = await prisma.authSession.findUnique({
      where: { id: payload.sid },
      select: authSessionSelect
    });

    if (
      session &&
      session.userId === payload.id &&
      session.revokedAt === null &&
      session.expiresAt > new Date() &&
      session.user.status === "ACTIVE" &&
      Boolean(session.user.emailVerifiedAt)
    ) {
      req.authUser = {
        id: session.user.id,
        sessionId: session.id,
        email: session.user.email,
        role: session.user.role
      };
    } else if (session?.revokedAt === null) {
      await prisma.authSession.updateMany({
        where: { id: session.id, revokedAt: null },
        data: { revokedAt: new Date() }
      });
      req.authUser = undefined;
    }
  } catch (_error) {
    req.authUser = undefined;
  }

  return next();
};
