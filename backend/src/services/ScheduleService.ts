import type { PrismaClient, ScheduleStatus } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { Schedule } from "../domain/Schedule.js";
import { ApiError } from "../utils/ApiError.js";
import { isValidTimeRange, timeRangesOverlap, toDateOnly } from "../utils/time.js";
import { ActivityLogService } from "./ActivityLogService.js";
import { LaboratoryService } from "./LaboratoryService.js";

type ScheduleInput = {
  laboratoryId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
};

export class ScheduleService {
  private readonly activityLogService: ActivityLogService;
  private readonly laboratoryService: LaboratoryService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
    this.laboratoryService = new LaboratoryService(db);
  }

  async listSchedules(filters: {
    laboratoryId?: number;
    date?: string;
  }) {
    return this.db.schedule.findMany({
      where: {
        laboratoryId: filters.laboratoryId,
        ...(filters.date ? { date: toDateOnly(filters.date) } : {})
      },
      include: {
        laboratory: true,
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

  async createSchedule(input: ScheduleInput, actorId: number) {
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
        createdById: actorId
      },
      include: {
        laboratory: true
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: "CREATE_SCHEDULE",
      entityType: "SCHEDULE",
      entityId: schedule.id,
      description: `Created a schedule for ${schedule.laboratory.roomCode} on ${input.date}.`
    });

    return schedule;
  }

  async updateSchedule(id: number, input: ScheduleInput, actorId: number) {
    const schedule = await this.db.schedule.findUnique({
      where: { id },
      include: { laboratory: true }
    });

    if (!schedule) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
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
      userId: actorId,
      action: "UPDATE_SCHEDULE",
      entityType: "SCHEDULE",
      entityId: updatedSchedule.id,
      description: `Updated schedule ${updatedSchedule.id} for ${updatedSchedule.laboratory.roomCode}.`
    });

    return updatedSchedule;
  }

  async deleteSchedule(id: number, actorId: number) {
    const schedule = await this.db.schedule.findUnique({
      where: { id },
      include: {
        reservations: true
      }
    });

    if (!schedule) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    if (schedule.reservations.length > 0) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Schedules with reservation history cannot be deleted."
      );
    }

    await this.db.schedule.delete({ where: { id } });

    await this.activityLogService.logActivity({
      userId: actorId,
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
}
