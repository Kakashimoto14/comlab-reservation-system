import type {
  PrismaClient,
  ReservationStatus,
  UserRole
} from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { Reservation } from "../domain/Reservation.js";
import { UserFactory } from "../domain/UserFactory.js";
import { ApiError } from "../utils/ApiError.js";
import {
  formatReservationCode,
  isValidTimeRange,
  timeRangesOverlap,
  toDateOnly
} from "../utils/time.js";
import { ActivityLogService } from "./ActivityLogService.js";
import { LaboratoryService } from "./LaboratoryService.js";
import { ScheduleService } from "./ScheduleService.js";

type CreateReservationInput = {
  scheduleId: number;
  laboratoryId: number;
  purpose: string;
  startTime: string;
  endTime: string;
};

type ReviewReservationInput = {
  status: "APPROVED" | "REJECTED";
  remarks?: string;
};

export class ReservationService {
  private readonly laboratoryService: LaboratoryService;
  private readonly scheduleService: ScheduleService;
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.laboratoryService = new LaboratoryService(db);
    this.scheduleService = new ScheduleService(db);
    this.activityLogService = new ActivityLogService(db);
  }

  async listReservations(currentUser: { id: number; role: UserRole }) {
    return this.db.reservation.findMany({
      where: currentUser.role === "STUDENT" ? { studentId: currentUser.id } : undefined,
      include: {
        laboratory: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentNumber: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      },
      orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }]
    });
  }

  async createReservation(input: CreateReservationInput, studentId: number) {
    const user = await this.db.user.findUnique({
      where: { id: studentId }
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Student account not found.");
    }

    const userEntity = UserFactory.create(user);

    if (!userEntity.canCreateReservation()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Your account is not allowed to create reservations."
      );
    }

    await this.laboratoryService.ensureLaboratoryIsAvailable(input.laboratoryId);
    this.validateTimeRange(input.startTime, input.endTime);
    const schedule = await this.db.schedule.findUnique({
      where: { id: input.scheduleId }
    });

    this.scheduleService.validateScheduleRecord(schedule);

    if (!schedule) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    if (schedule.laboratoryId !== input.laboratoryId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "The selected schedule does not belong to this laboratory."
      );
    }

    if (schedule.startTime > input.startTime || schedule.endTime < input.endTime) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `Your reservation must stay within the published schedule on ${schedule.date.toISOString().slice(0, 10)} from ${schedule.startTime} to ${schedule.endTime}.`
      );
    }

    await this.ensureNoReservationConflict(
      input.laboratoryId,
      schedule.date,
      input.startTime,
      input.endTime
    );

    const createdReservation = await this.db.$transaction(async (tx) => {
      const reservation = await tx.reservation.create({
        data: {
          reservationCode: "PENDING-CODE",
          studentId,
          laboratoryId: input.laboratoryId,
          scheduleId: schedule.id,
          purpose: input.purpose,
          reservationDate: toDateOnly(schedule.date),
          startTime: input.startTime,
          endTime: input.endTime
        }
      });

      const reservationCode = formatReservationCode(reservation.id);

      return tx.reservation.update({
        where: { id: reservation.id },
        data: {
          reservationCode
        },
        include: {
          laboratory: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              studentNumber: true
            }
          }
        }
      });
    });

    await this.activityLogService.logActivity({
      userId: studentId,
      action: "CREATE_RESERVATION",
      entityType: "RESERVATION",
      entityId: createdReservation.id,
      description: `Submitted reservation ${createdReservation.reservationCode}.`
    });

    return createdReservation;
  }

  async cancelReservation(reservationId: number, studentId: number) {
    const reservationRecord = await this.db.reservation.findUnique({
      where: { id: reservationId }
    });

    if (!reservationRecord) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Reservation not found.");
    }

    const reservation = new Reservation(reservationRecord);

    if (reservationRecord.studentId !== studentId) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "You can only cancel your own reservations."
      );
    }

    if (!reservation.canBeCancelledByStudent()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Only pending reservations can be cancelled."
      );
    }

    const updatedReservation = await this.db.reservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date()
      }
    });

    await this.activityLogService.logActivity({
      userId: studentId,
      action: "CANCEL_RESERVATION",
      entityType: "RESERVATION",
      entityId: updatedReservation.id,
      description: `Cancelled reservation ${updatedReservation.reservationCode}.`
    });

    return updatedReservation;
  }

  async reviewReservation(
    reservationId: number,
    input: ReviewReservationInput,
    reviewerId: number
  ) {
    const [reviewer, reservationRecord] = await Promise.all([
      this.db.user.findUnique({ where: { id: reviewerId } }),
      this.db.reservation.findUnique({
        where: { id: reservationId },
        include: {
          laboratory: true
        }
      })
    ]);

    if (!reviewer) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Reviewer account not found.");
    }

    if (!reservationRecord) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Reservation not found.");
    }

    const reviewerEntity = UserFactory.create(reviewer);

    if (!reviewerEntity.canReviewReservations()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Your role is not allowed to review reservations."
      );
    }

    const reservation = new Reservation(reservationRecord);

    if (!reservation.isPending()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Only pending reservations can be reviewed."
      );
    }

    if (input.status === "APPROVED") {
      await this.ensureNoReservationConflict(
        reservationRecord.laboratoryId,
        reservationRecord.reservationDate,
        reservationRecord.startTime,
        reservationRecord.endTime,
        reservationRecord.id
      );
    }

    const updatedReservation = await this.db.reservation.update({
      where: { id: reservationId },
      data: {
        status: input.status,
        remarks: input.remarks ?? null,
        reviewedById: reviewerId,
        reviewedAt: new Date()
      },
      include: {
        laboratory: true,
        student: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            studentNumber: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true
          }
        }
      }
    });

    await this.activityLogService.logActivity({
      userId: reviewerId,
      action: input.status === "APPROVED" ? "APPROVE_RESERVATION" : "REJECT_RESERVATION",
      entityType: "RESERVATION",
      entityId: updatedReservation.id,
      description: `${input.status === "APPROVED" ? "Approved" : "Rejected"} reservation ${updatedReservation.reservationCode}.`
    });

    return updatedReservation;
  }

  async completeReservation(reservationId: number, reviewerId: number, remarks?: string) {
    const [reviewer, reservationRecord] = await Promise.all([
      this.db.user.findUnique({ where: { id: reviewerId } }),
      this.db.reservation.findUnique({
        where: { id: reservationId }
      })
    ]);

    if (!reviewer) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Reviewer account not found.");
    }

    if (!reservationRecord) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Reservation not found.");
    }

    const reviewerEntity = UserFactory.create(reviewer);

    if (!reviewerEntity.canReviewReservations()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Your role is not allowed to complete reservations."
      );
    }

    const reservation = new Reservation(reservationRecord);

    if (!reservation.canBeCompleted()) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Only approved reservations can be marked as completed."
      );
    }

    const updatedReservation = await this.db.reservation.update({
      where: { id: reservationId },
      data: {
        status: "COMPLETED",
        remarks: remarks ?? reservationRecord.remarks,
        reviewedById: reviewerId,
        reviewedAt: new Date()
      }
    });

    await this.activityLogService.logActivity({
      userId: reviewerId,
      action: "COMPLETE_RESERVATION",
      entityType: "RESERVATION",
      entityId: updatedReservation.id,
      description: `Marked reservation ${updatedReservation.reservationCode} as completed.`
    });

    return updatedReservation;
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (!isValidTimeRange(startTime, endTime)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Reservation end time must be later than the start time."
      );
    }
  }

  async ensureNoReservationConflict(
    laboratoryId: number,
    reservationDate: string | Date,
    startTime: string,
    endTime: string,
    excludeReservationId?: number
  ) {
    const conflictingReservations = await this.db.reservation.findMany({
      where: {
        laboratoryId,
        reservationDate: toDateOnly(reservationDate),
        status: {
          in: ["PENDING", "APPROVED", "COMPLETED"] as ReservationStatus[]
        },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {})
      }
    });

    const conflictingReservation = conflictingReservations.find((existingReservation) =>
      timeRangesOverlap(
        existingReservation.startTime,
        existingReservation.endTime,
        startTime,
        endTime
      )
    );

    if (conflictingReservation) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `This laboratory already has reservation ${conflictingReservation.reservationCode} from ${conflictingReservation.startTime} to ${conflictingReservation.endTime} on ${toDateOnly(reservationDate).toISOString().slice(0, 10)}. Choose another open time slot.`
      );
    }
  }
}
