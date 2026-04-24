import type { LaboratoryStatus, PCStatus, Prisma as PrismaNamespace, PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { Laboratory } from "../domain/Laboratory.js";
import { ApiError } from "../utils/ApiError.js";
import { toDateOnly } from "../utils/time.js";
import { ActivityLogService } from "./ActivityLogService.js";

type LaboratoryInput = {
  name: string;
  roomCode: string;
  building: string;
  location?: string;
  capacity: number;
  computerCount: number;
  description: string;
  status: LaboratoryStatus;
  imageUrl?: string;
  custodianId?: number | null;
};

type LaboratoryAssignmentFilters = {
  building?: string;
  department?: string;
};

type LaboratoryAvailabilityFilters = {
  date?: string;
};

type UpdatePcStatusInput = {
  status: PCStatus;
};

const laboratoryListInclude = {
  custodian: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      department: true,
      role: true,
      status: true
    }
  },
  _count: {
    select: {
      pcs: true,
      schedules: true,
      reservations: true
    }
  }
} satisfies PrismaNamespace.LaboratoryInclude;

export class LaboratoryService {
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
  }

  async listLaboratories(includeUnavailable = true) {
    return this.db.laboratory.findMany({
      where: includeUnavailable ? undefined : { status: "AVAILABLE" },
      include: laboratoryListInclude,
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
  }

  async getLaboratoryById(id: number) {
    const laboratory = await this.db.laboratory.findUnique({
      where: { id },
      include: {
        custodian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            role: true,
            status: true
          }
        },
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
            pcId: true,
            reservationType: true,
            reservationDate: true,
            startTime: true,
            endTime: true,
            status: true,
            reservationCode: true
          }
        },
        pcs: {
          orderBy: {
            pcNumber: "asc"
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

    await this.ensureValidCustodian(input.custodianId);

    const laboratory = await this.db.$transaction(async (tx) => {
      const createdLaboratory = await tx.laboratory.create({
        data: {
          name: input.name,
          roomCode: input.roomCode,
          building: input.building,
          location: this.buildLocation(input),
          capacity: input.capacity,
          computerCount: input.computerCount,
          description: input.description,
          status: input.status,
          imageUrl: input.imageUrl ?? null,
          custodianId: input.custodianId ?? null
        },
        include: laboratoryListInclude
      });

      await this.syncLaboratoryPcs(tx, createdLaboratory.id, input.computerCount);

      return createdLaboratory;
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: laboratory.id,
      action: "CREATE_LABORATORY",
      entityType: "LABORATORY",
      entityId: laboratory.id,
      description: `Created laboratory ${laboratory.name} (${laboratory.roomCode}).`,
      metadata: {
        custodianId: laboratory.custodianId
      }
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

    await this.ensureValidCustodian(input.custodianId);

    const updatedLaboratory = await this.db.$transaction(async (tx) => {
      const record = await tx.laboratory.update({
        where: { id },
        data: {
          name: input.name,
          roomCode: input.roomCode,
          building: input.building,
          location: this.buildLocation(input),
          capacity: input.capacity,
          computerCount: input.computerCount,
          description: input.description,
          status: input.status,
          imageUrl: input.imageUrl ?? null,
          ...(typeof input.custodianId !== "undefined"
            ? { custodianId: input.custodianId }
            : {})
        },
        include: laboratoryListInclude
      });

      await this.syncLaboratoryPcs(tx, id, input.computerCount);

      return record;
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: updatedLaboratory.id,
      action: "UPDATE_LABORATORY",
      entityType: "LABORATORY",
      entityId: updatedLaboratory.id,
      description: `Updated laboratory ${updatedLaboratory.name} (${updatedLaboratory.roomCode}).`,
      metadata: {
        custodianId: updatedLaboratory.custodianId
      }
    });

    return updatedLaboratory;
  }

  async deleteLaboratory(id: number, actorId: number) {
    const laboratory = await this.db.laboratory.findUnique({
      where: { id },
      include: {
        reservations: true,
        calendarEvents: true
      }
    });

    if (!laboratory) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }

    if (laboratory.reservations.length > 0 || laboratory.calendarEvents.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Laboratories with reservation or calendar history cannot be deleted."
      );
    }

    await this.db.laboratory.delete({
      where: { id }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: laboratory.id,
      action: "DELETE_LABORATORY",
      entityType: "LABORATORY",
      entityId: laboratory.id,
      description: `Deleted laboratory ${laboratory.name} (${laboratory.roomCode}).`
    });
  }

  async assignStaffToLaboratory(
    laboratoryId: number,
    custodianId: number | null,
    actorId: number
  ) {
    const laboratory = await this.db.laboratory.findUnique({
      where: { id: laboratoryId }
    });

    if (!laboratory) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }

    await this.ensureValidCustodian(custodianId);

    const updatedLaboratory = await this.db.laboratory.update({
      where: { id: laboratoryId },
      data: {
        custodianId
      },
      include: laboratoryListInclude
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: updatedLaboratory.id,
      action: custodianId ? "ASSIGN_LAB_STAFF" : "UNASSIGN_LAB_STAFF",
      entityType: "LABORATORY",
      entityId: updatedLaboratory.id,
      description: custodianId
        ? `Assigned a laboratory custodian to ${updatedLaboratory.roomCode}.`
        : `Removed the laboratory custodian from ${updatedLaboratory.roomCode}.`,
      metadata: {
        custodianId
      }
    });

    return updatedLaboratory;
  }

  async listLaboratoryAssignments(filters: LaboratoryAssignmentFilters) {
    return this.db.laboratory.findMany({
      where: {
        ...(filters.building ? { building: filters.building } : {}),
        ...(filters.department
          ? {
              custodian: {
                department: filters.department
              }
            }
          : {})
      },
      include: {
        custodian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            status: true
          }
        },
        _count: {
          select: {
            pcs: true
          }
        }
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
  }

  async listAssignableStaff() {
    return this.db.user.findMany({
      where: {
        role: "LABORATORY_STAFF",
        status: "ACTIVE"
      },
      include: {
        assignedLaboratories: {
          select: {
            id: true,
            name: true,
            roomCode: true
          },
          orderBy: {
            roomCode: "asc"
          }
        }
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }]
    });
  }

  async getLaboratoryPcs(laboratoryId: number) {
    return this.db.pC.findMany({
      where: {
        laboratoryId
      },
      include: {
        reservations: {
          where: {
            status: {
              in: ["PENDING", "APPROVED", "COMPLETED"]
            }
          },
          orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }],
          take: 5,
          select: {
            id: true,
            reservationCode: true,
            reservationDate: true,
            startTime: true,
            endTime: true,
            status: true
          }
        }
      },
      orderBy: {
        pcNumber: "asc"
      }
    });
  }

  async updatePcStatus(
    laboratoryId: number,
    pcId: number,
    input: UpdatePcStatusInput,
    actorId: number
  ) {
    const pc = await this.db.pC.findFirst({
      where: {
        id: pcId,
        laboratoryId
      },
      include: {
        laboratory: true
      }
    });

    if (!pc) {
      throw new ApiError(StatusCodes.NOT_FOUND, "PC not found.");
    }

    const updatedPc = await this.db.pC.update({
      where: {
        id: pcId
      },
      data: {
        status: input.status
      },
      include: {
        laboratory: true
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: updatedPc.laboratoryId,
      pcId: updatedPc.id,
      action: "UPDATE_PC_STATUS",
      entityType: "PC",
      entityId: updatedPc.id,
      description: `Updated ${updatedPc.pcNumber} in ${updatedPc.laboratory.roomCode} to ${updatedPc.status}.`,
      metadata: {
        status: updatedPc.status
      }
    });

    return updatedPc;
  }

  async getStaffAvailability(filters: LaboratoryAvailabilityFilters) {
    const targetDate = filters.date ? toDateOnly(filters.date) : null;

    const laboratories = await this.db.laboratory.findMany({
      include: {
        custodian: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        schedules: {
          where: targetDate ? { date: targetDate } : undefined,
          orderBy: [{ date: "asc" }, { startTime: "asc" }],
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            status: true
          }
        },
        reservations: {
          where: targetDate
            ? {
                reservationDate: targetDate,
                status: {
                  in: ["PENDING", "APPROVED", "COMPLETED"]
                }
              }
            : {
                reservationDate: {
                  gte: new Date()
                },
                status: {
                  in: ["PENDING", "APPROVED", "COMPLETED"]
                }
              },
          select: {
            id: true,
            reservationType: true,
            pcId: true,
            reservationDate: true,
            startTime: true,
            endTime: true,
            status: true
          }
        },
        pcs: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });

    return laboratories.map((laboratory) => {
      const occupiedPcCount = laboratory.pcs.filter((pc) => pc.status !== "AVAILABLE").length;
      const availableScheduleCount = laboratory.schedules.filter(
        (schedule) => schedule.status === "AVAILABLE"
      ).length;
      const hasWholeLabReservation = laboratory.reservations.some(
        (reservation) => reservation.reservationType === "LAB"
      );

      return {
        id: laboratory.id,
        name: laboratory.name,
        roomCode: laboratory.roomCode,
        building: laboratory.building,
        location: laboratory.location,
        status: laboratory.status,
        custodian: laboratory.custodian,
        availableScheduleCount,
        totalPcCount: laboratory.pcs.length,
        occupiedPcCount,
        reservationLoad: laboratory.reservations.length,
        availabilityStatus:
          laboratory.status !== "AVAILABLE"
            ? laboratory.status
            : hasWholeLabReservation
              ? "FULLY_BOOKED"
              : occupiedPcCount >= laboratory.pcs.length && laboratory.pcs.length > 0
                ? "PCS_FULL"
                : "OPEN"
      };
    });
  }

  async getPublicSchedules(filters: LaboratoryAvailabilityFilters) {
    const targetDate = filters.date ? toDateOnly(filters.date) : undefined;

    return this.db.schedule.findMany({
      where: {
        status: "AVAILABLE",
        ...(targetDate ? { date: targetDate } : {})
      },
      include: {
        laboratory: {
          select: {
            id: true,
            name: true,
            roomCode: true,
            building: true,
            location: true,
            status: true
          }
        }
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }]
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

  async getStaffManagedLaboratory(staffId: number) {
    const laboratory = await this.db.laboratory.findFirst({
      where: {
        custodianId: staffId
      },
      include: {
        custodian: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            department: true,
            role: true
          }
        },
        _count: {
          select: {
            pcs: true,
            schedules: true,
            reservations: true
          }
        }
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });

    if (!laboratory) {
      throw new ApiError(StatusCodes.NOT_FOUND, "No laboratory is assigned to this staff account.");
    }

    return laboratory;
  }

  private buildLocation(input: LaboratoryInput) {
    return input.location?.trim() || `${input.building.trim()} - ${input.roomCode.trim()}`;
  }

  private async ensureValidCustodian(custodianId?: number | null) {
    if (typeof custodianId === "undefined" || custodianId === null) {
      return;
    }

    const custodian = await this.db.user.findUnique({
      where: {
        id: custodianId
      }
    });

    if (!custodian || custodian.role !== "LABORATORY_STAFF") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "The selected custodian must be an active laboratory staff account."
      );
    }

    if (custodian.status !== "ACTIVE") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Only active laboratory staff accounts can be assigned to a laboratory."
      );
    }
  }

  private async syncLaboratoryPcs(
    tx: PrismaNamespace.TransactionClient,
    laboratoryId: number,
    computerCount: number
  ) {
    const existingPcs = await tx.pC.findMany({
      where: {
        laboratoryId
      },
      include: {
        reservations: {
          select: {
            id: true
          }
        },
        calendarEvents: {
          select: {
            id: true
          }
        },
        activityLogs: {
          select: {
            id: true
          }
        }
      },
      orderBy: {
        pcNumber: "asc"
      }
    });

    const expectedPcNumbers = Array.from({ length: computerCount }, (_, index) =>
      this.formatPcNumber(index + 1)
    );
    const existingNumbers = new Set(existingPcs.map((pc) => pc.pcNumber));

    const pcsToCreate = expectedPcNumbers.filter((pcNumber) => !existingNumbers.has(pcNumber));

    if (pcsToCreate.length > 0) {
      await tx.pC.createMany({
        data: pcsToCreate.map((pcNumber) => ({
          laboratoryId,
          pcNumber,
          status: "AVAILABLE"
        }))
      });
    }

    const pcsOutsideCount = existingPcs.filter((pc) => !expectedPcNumbers.includes(pc.pcNumber));

    for (const pc of pcsOutsideCount) {
      const hasHistory =
        pc.reservations.length > 0 || pc.calendarEvents.length > 0 || pc.activityLogs.length > 0;

      if (hasHistory) {
        await tx.pC.update({
          where: {
            id: pc.id
          },
          data: {
            status: "MAINTENANCE"
          }
        });

        continue;
      }

      await tx.pC.delete({
        where: {
          id: pc.id
        }
      });
    }
  }

  private formatPcNumber(index: number) {
    return `PC-${String(index).padStart(2, "0")}`;
  }
}
