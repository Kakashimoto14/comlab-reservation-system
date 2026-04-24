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
      include: {
        laboratory: {
          include: {
            custodian: {
              select: {
                id: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
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
    await this.ensureNoOverlap(input.laboratoryId, input.date, input.startTime, input.endTime);

    const schedule = await this.db.schedule.create({
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
      include: { laboratory: true }
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
    await this.ensureNoOverlap(
      input.laboratoryId,
      input.date,
      input.startTime,
      input.endTime,
      id
    );

    const updatedSchedule = await this.db.schedule.update({
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
      include: {
        reservations: true
      }
    });

    if (!schedule) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    await this.staffAccessService.ensureCanManageLab(currentUser, schedule.laboratoryId);

    if (schedule.reservations.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Schedules with reservation history cannot be deleted."
      );
    }

    await this.db.schedule.delete({ where: { id } });

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
    excludeId?: number
  ) {
    const schedules = await this.db.schedule.findMany({
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
