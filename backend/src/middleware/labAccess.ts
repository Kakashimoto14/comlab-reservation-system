import { StatusCodes } from "http-status-codes";
import type { NextFunction, Request, Response } from "express";

import { prisma } from "../config/prisma.js";
import { StaffAccessService } from "../services/StaffAccessService.js";
import { ApiError } from "../utils/ApiError.js";

const staffAccessService = new StaffAccessService(prisma);

type LabIdResolver = number | string | ((req: Request) => number | undefined);

const resolveLabId = (req: Request, resolver: LabIdResolver) => {
  if (typeof resolver === "number") {
    return resolver;
  }

  if (typeof resolver === "string") {
    const source =
      req.params[resolver] ??
      (req.body && typeof req.body === "object" ? req.body[resolver] : undefined) ??
      req.query[resolver];

    return source ? Number(source) : undefined;
  }

  return resolver(req);
};

export const requireAssignedLabManager =
  (labIdResolver: LabIdResolver) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required."));
    }

    const laboratoryId = resolveLabId(req, labIdResolver);

    if (!laboratoryId || Number.isNaN(laboratoryId)) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, "A laboratory identifier is required."));
    }

    try {
      await staffAccessService.ensureCanManageLab(req.authUser, laboratoryId);
      return next();
    } catch (error) {
      return next(error);
    }
  };

export const allowReadOtherLabAvailability =
  () => (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required."));
    }

    if (!["ADMIN", "LABORATORY_STAFF"].includes(req.authUser.role)) {
      return next(
        new ApiError(
          StatusCodes.FORBIDDEN,
          "You do not have permission to view staff laboratory availability."
        )
      );
    }

    return next();
  };
