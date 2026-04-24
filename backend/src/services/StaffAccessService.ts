import type { PrismaClient, UserRole } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { ApiError } from "../utils/ApiError.js";

type CurrentUser = {
  id: number;
  role: UserRole;
};

export class StaffAccessService {
  constructor(private readonly db: PrismaClient) {}

  async getAssignedLabIds(staffId: number) {
    const laboratories = await this.db.laboratory.findMany({
      where: {
        custodianId: staffId
      },
      select: {
        id: true
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });

    return laboratories.map((laboratory) => laboratory.id);
  }

  async getPrimaryAssignedLab(staffId: number) {
    return this.db.laboratory.findFirst({
      where: {
        custodianId: staffId
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
  }

  async ensureCanManageLab(currentUser: CurrentUser, laboratoryId: number) {
    if (currentUser.role === "ADMIN") {
      return;
    }

    if (currentUser.role !== "LABORATORY_STAFF") {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You do not have permission to manage laboratory records."
      );
    }

    const laboratory = await this.db.laboratory.findFirst({
      where: {
        id: laboratoryId,
        custodianId: currentUser.id
      },
      select: {
        id: true
      }
    });

    if (!laboratory) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You can only manage the laboratory assigned to your staff account."
      );
    }
  }

  async ensureStaffHasAssignedLab(staffId: number) {
    const assignedLab = await this.getPrimaryAssignedLab(staffId);

    if (!assignedLab) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "No laboratory is assigned to this staff account."
      );
    }

    return assignedLab;
  }
}
