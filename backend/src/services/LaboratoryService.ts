import type { LaboratoryStatus, PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { Laboratory } from "../domain/Laboratory.js";
import { ApiError } from "../utils/ApiError.js";
import { ActivityLogService } from "./ActivityLogService.js";

type LaboratoryInput = {
  name: string;
  roomCode: string;
  building: string;
  capacity: number;
  computerCount: number;
  description: string;
  status: LaboratoryStatus;
  imageUrl?: string;
};

export class LaboratoryService {
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
  }

  async listLaboratories(includeUnavailable = true) {
    return this.db.laboratory.findMany({
      where: includeUnavailable ? undefined : { status: "AVAILABLE" },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
  }

  async getLaboratoryById(id: number) {
    const laboratory = await this.db.laboratory.findUnique({
      where: { id },
      include: {
        schedules: {
          orderBy: [{ date: "asc" }, { startTime: "asc" }]
        },
        reservations: {
          where: {
            status: {
              in: ["PENDING", "APPROVED", "COMPLETED"]
            }
          },
          orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }],
          select: {
            id: true,
            scheduleId: true,
            reservationDate: true,
            startTime: true,
            endTime: true,
            status: true,
            reservationCode: true
          }
        }
      }
    });

    if (!laboratory) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }

    return laboratory;
  }

  async createLaboratory(input: LaboratoryInput, actorId: number) {
    const existingLaboratory = await this.db.laboratory.findUnique({
      where: { roomCode: input.roomCode }
    });

    if (existingLaboratory) {
      throw new ApiError(StatusCodes.CONFLICT, "Room code already exists.");
    }

    const laboratory = await this.db.laboratory.create({
      data: {
        ...input,
        imageUrl: input.imageUrl ?? null
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: "CREATE_LABORATORY",
      entityType: "LABORATORY",
      entityId: laboratory.id,
      description: `Created laboratory ${laboratory.name} (${laboratory.roomCode}).`
    });

    return laboratory;
  }

  async updateLaboratory(id: number, input: LaboratoryInput, actorId: number) {
    const laboratory = await this.db.laboratory.findUnique({
      where: { id }
    });

    if (!laboratory) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }

    const duplicateRoom = await this.db.laboratory.findFirst({
      where: {
        id: { not: id },
        roomCode: input.roomCode
      }
    });

    if (duplicateRoom) {
      throw new ApiError(StatusCodes.CONFLICT, "Room code already exists.");
    }

    const updatedLaboratory = await this.db.laboratory.update({
      where: { id },
      data: {
        ...input,
        imageUrl: input.imageUrl ?? null
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: "UPDATE_LABORATORY",
      entityType: "LABORATORY",
      entityId: updatedLaboratory.id,
      description: `Updated laboratory ${updatedLaboratory.name} (${updatedLaboratory.roomCode}).`
    });

    return updatedLaboratory;
  }

  async deleteLaboratory(id: number, actorId: number) {
    const laboratory = await this.db.laboratory.findUnique({
      where: { id },
      include: {
        reservations: true
      }
    });

    if (!laboratory) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }

    if (laboratory.reservations.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Laboratories with reservation history cannot be deleted."
      );
    }

    await this.db.laboratory.delete({
      where: { id }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: "DELETE_LABORATORY",
      entityType: "LABORATORY",
      entityId: laboratory.id,
      description: `Deleted laboratory ${laboratory.name} (${laboratory.roomCode}).`
    });
  }

  async ensureLaboratoryIsAvailable(laboratoryId: number) {
    const laboratoryRecord = await this.db.laboratory.findUnique({
      where: { id: laboratoryId }
    });

    if (!laboratoryRecord) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }

    const laboratory = new Laboratory(laboratoryRecord);

    if (!laboratory.canAcceptReservations()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "This laboratory is not available for reservations."
      );
    }

    return laboratoryRecord;
  }
}
