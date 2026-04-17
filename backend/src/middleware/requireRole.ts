import { StatusCodes } from "http-status-codes";
import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/ApiError.js";

export const requireRole = (...roles: Array<NonNullable<Request["authUser"]>["role"]>) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required."));
    }

    if (!roles.includes(req.authUser.role)) {
      return next(
        new ApiError(StatusCodes.FORBIDDEN, "You do not have permission for this action.")
      );
    }

    return next();
  };
