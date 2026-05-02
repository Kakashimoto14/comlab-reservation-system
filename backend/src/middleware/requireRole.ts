import { StatusCodes } from "http-status-codes";
import type { NextFunction, Request, Response } from "express";

import { ApiError } from "../utils/ApiError.js";

type AuthenticatedRole = NonNullable<Request["authUser"]>["role"];
type AllowedRole = AuthenticatedRole | "CUSTODIAN";

const normalizeRole = (role: AllowedRole): AuthenticatedRole =>
  role === "CUSTODIAN" ? "LABORATORY_STAFF" : role;

export const authorizeRoles =
  (...roles: AllowedRole[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return next(new ApiError(StatusCodes.UNAUTHORIZED, "Authentication required."));
    }

    const allowedRoles = roles.map(normalizeRole);

    if (!allowedRoles.includes(req.authUser.role)) {
      return next(
        new ApiError(StatusCodes.FORBIDDEN, "You do not have permission for this action.")
      );
    }

    return next();
  };

export const requireRole = authorizeRoles;
