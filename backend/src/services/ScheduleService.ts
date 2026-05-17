import { Prisma } from "@prisma/client";
import type { PrismaClient, ScheduleStatus, UserRole } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { Schedule } from "../domain/Schedule.js";
import { ApiError } from "../utils/ApiError.js";
import { isValidTimeRange, timeRangesOverlap, toDateOnly } from "../utils/time.js";
import { ActivityLogService } from "./ActivityLogService.js";
import { LaboratoryService } from "./LaboratoryService.js";
import { StaffAccessService } from "./StaffAccessService.js";

type ScheduleInput = {
  laboratoryId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
};

type CurrentUser = {
  id: number;
  role: UserRole;
};

type DbClient = PrismaClient | Prisma.TransactionClient;
const scheduleTransactionOptions = {
  maxWait: 10_000,
  timeout: 20_000
};

export class ScheduleService {
  private readonly activityLogService: ActivityLogService;
  private readonly laboratoryService: LaboratoryService;
  private readonly staffAccessService: StaffAccessService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
    this.laboratoryService = new LaboratoryService(db);
    this.staffAccessService = new StaffAccessService(db);
  }

  async listSchedules(
    filters: {
      laboratoryId?: number;
      date?: string;
    },
    currentUser?: CurrentUser
  ) {
    const laboratoryIds = await this.resolveAccessibleLaboratoryIds(currentUser, filters.laboratoryId);

    return this.db.schedule.findMany({
      where: {
        ...(typeof laboratoryIds === "undefined"
          ? {}
          : {
              laboratoryId:
                Array.isArray(laboratoryIds) && laboratoryIds.length === 1
                  ? laboratoryIds[0]
                  : { in: laboratoryIds }
            }),
        ...(filters.date ? { date: toDateOnly(filters.date) } : {})
      },
      select: {
        id: true,
        laboratoryId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
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

  async createSchedule(input: ScheduleInput, currentUser: CurrentUser) {
    await this.staffAccessService.ensureCanManageLab(currentUser, input.laboratoryId);
    await this.laboratoryService.ensureLaboratoryIsAvailable(input.laboratoryId);
    this.validateTimeRange(input.startTime, input.endTime);
    
    const schedule = await this.runTransaction(async (tx) => {
      await this.lockLaboratories(tx, [input.laboratoryId]);
      await this.ensureNoOverlap(
        input.laboratoryId,
        input.date,
        input.startTime,
        input.endTime,
        undefined,
        tx
      );

      return tx.schedule.create({
        data: {
          laboratoryId: input.laboratoryId,
          date: toDateOnly(input.date),
          startTime: input.startTime,
          endTime: input.endTime,
          status: input.status,
          createdById: currentUser.id
        },
        include: {
          laboratory: true
        }
      });
    });

    await this.activityLogService.logActivity({
      userId: currentUser.id,
      labId: schedule.laboratoryId,
      action: "CREATE_SCHEDULE",
      entityType: "SCHEDULE",
      entityId: schedule.id,
      description: `Created a schedule for ${schedule.laboratory.roomCode} on ${input.date}.`
    });

    return schedule;
  }

  async updateSchedule(id: number, input: ScheduleInput, currentUser: CurrentUser) {
    const schedule = await this.db.schedule.findUnique({
      where: { id },
      select: {
        id: true,
        laboratoryId: true,
        date: true,
        startTime: true,
        endTime: true,
        status: true
      }
    });

    if (!schedule) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    await this.staffAccessService.ensureCanManageLab(currentUser, schedule.laboratoryId);

    if (input.laboratoryId !== schedule.laboratoryId) {
      await this.staffAccessService.ensureCanManageLab(currentUser, input.laboratoryId);
    }

    await this.laboratoryService.ensureLaboratoryIsAvailable(input.laboratoryId);
    this.validateTimeRange(input.startTime, input.endTime);

    const updatedSchedule = await this.runTransaction(async (tx) => {
      const currentSchedule = await this.lockAndLoadSchedule(tx, id);

      if (!currentSchedule) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
      }

      const hasMutation =
        input.laboratoryId !== currentSchedule.laboratoryId ||
        toDateOnly(input.date).getTime() !== currentSchedule.date.getTime() ||
        input.startTime !== currentSchedule.startTime ||
        input.endTime !== currentSchedule.endTime ||
        input.status !== currentSchedule.status;

      const reservationCount = await tx.reservation.count({
        where: {
          scheduleId: id
        }
      });

      if (reservationCount > 0 && hasMutation) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Schedules with reservation history cannot be modified."
        );
      }

      await this.lockLaboratories(tx, [currentSchedule.laboratoryId, input.laboratoryId]);
      await this.ensureNoOverlap(
        input.laboratoryId,
        input.date,
        input.startTime,
        input.endTime,
        id,
        tx
      );

      return tx.schedule.update({
        where: { id },
        data: {
          laboratoryId: input.laboratoryId,
          date: toDateOnly(input.date),
          startTime: input.startTime,
          endTime: input.endTime,
          status: input.status
        },
        include: {
          laboratory: true
        }
      });
    });

    await this.activityLogService.logActivity({
      userId: currentUser.id,
      labId: updatedSchedule.laboratoryId,
      action: "UPDATE_SCHEDULE",
      entityType: "SCHEDULE",
      entityId: updatedSchedule.id,
      description: `Updated schedule ${updatedSchedule.id} for ${updatedSchedule.laboratory.roomCode}.`
    });

    return updatedSchedule;
  }

  async deleteSchedule(id: number, currentUser: CurrentUser) {
    const schedule = await this.db.schedule.findUnique({
      where: { id },
      select: {
        id: true,
        laboratoryId: true
      }
    });

    if (!schedule) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    await this.staffAccessService.ensureCanManageLab(currentUser, schedule.laboratoryId);

    await this.runTransaction(async (tx) => {
      const currentSchedule = await this.lockAndLoadSchedule(tx, id);

      if (!currentSchedule) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
      }

      const reservationCount = await tx.reservation.count({
        where: {
          scheduleId: id
        }
      });

      if (reservationCount > 0) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Schedules with reservation history cannot be deleted."
        );
      }

      await tx.schedule.delete({ where: { id } });
    });

    await this.activityLogService.logActivity({
      userId: currentUser.id,
      labId: schedule.laboratoryId,
      action: "DELETE_SCHEDULE",
      entityType: "SCHEDULE",
      entityId: schedule.id,
      description: `Deleted schedule ${schedule.id}.`
    });
  }

  async findMatchingSchedule(
    laboratoryId: number,
    date: string,
    startTime: string,
    endTime: string
  ) {
    const schedules = await this.db.schedule.findMany({
      where: {
        laboratoryId,
        date: toDateOnly(date),
        status: "AVAILABLE"
      }
    });

    return schedules.find(
      (scheduleRecord) =>
        scheduleRecord.startTime <= startTime && scheduleRecord.endTime >= endTime
    );
  }

  validateScheduleRecord(scheduleRecord: Awaited<ReturnType<PrismaClient["schedule"]["findUnique"]>>) {
    if (!scheduleRecord) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    const schedule = new Schedule(scheduleRecord);

    if (!schedule.isBookable()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "This schedule is currently not available for reservation."
      );
    }

    if (!schedule.hasValidTimeRange()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, "Invalid schedule time range.");
    }
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (!isValidTimeRange(startTime, endTime)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "End time must be later than the start time."
      );
    }
  }

  private async ensureNoOverlap(
    laboratoryId: number,
    date: string,
    startTime: string,
    endTime: string,
    excludeId?: number,
    dbClient: DbClient = this.db
  ) {
    const schedules = await dbClient.schedule.findMany({
      where: {
        laboratoryId,
        date: toDateOnly(date),
        ...(excludeId ? { id: { not: excludeId } } : {})
      }
    });

    const hasOverlap = schedules.some((existingSchedule) =>
      timeRangesOverlap(
        existingSchedule.startTime,
        existingSchedule.endTime,
        startTime,
        endTime
      )
    );

    if (hasOverlap) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "The selected schedule overlaps with an existing schedule."
      );
    }
  }

  private async lockLaboratories(tx: Prisma.TransactionClient, laboratoryIds: number[]) {
    const uniqueLaboratoryIds = [...new Set(laboratoryIds)].sort((left, right) => left - right);

    if (uniqueLaboratoryIds.length === 0) {
      return;
    }

    await tx.$queryRaw`
      SELECT id
      FROM "Laboratory"
      WHERE id IN (${Prisma.join(uniqueLaboratoryIds)})
      FOR UPDATE
    `;
  }

  private async lockAndLoadSchedule(tx: Prisma.TransactionClient, scheduleId: number) {
    const scheduleRows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM "Schedule"
      WHERE id = ${scheduleId}
      FOR UPDATE
    `;

    if (!scheduleRows.length) {
      return null;
    }

    return tx.schedule.findUnique({
      where: { id: scheduleId }
    });
  }

  private runTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(callback, scheduleTransactionOptions);
  }

  private async resolveAccessibleLaboratoryIds(
    currentUser: CurrentUser | undefined,
    requestedLaboratoryId?: number
  ) {
    if (!currentUser || currentUser.role !== "LABORATORY_STAFF") {
      return typeof requestedLaboratoryId === "number" ? [requestedLaboratoryId] : undefined;
    }

    const assignedLabIds = await this.staffAccessService.getAssignedLabIds(currentUser.id);

    if (assignedLabIds.length === 0) {
      return [];
    }

    if (typeof requestedLaboratoryId === "number") {
      return assignedLabIds.includes(requestedLaboratoryId) ? [requestedLaboratoryId] : [];
    }

    return assignedLabIds;
  }
}
