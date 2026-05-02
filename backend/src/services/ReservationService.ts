import type {
  Prisma,
  PrismaClient,
  ReservationStatus,
  ReservationType,
  UserRole
} from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { Reservation } from "../domain/Reservation.js";
import { notificationEventBus } from "../notifications/NotificationEventBus.js";
import { UserFactory } from "../domain/UserFactory.js";
import { ApiError } from "../utils/ApiError.js";
import { formatReservationCode, isValidTimeRange, toDateOnly } from "../utils/time.js";
import { ActivityLogService } from "./ActivityLogService.js";
import { LaboratoryService } from "./LaboratoryService.js";
import { ScheduleService } from "./ScheduleService.js";
import { StaffAccessService } from "./StaffAccessService.js";

type CreateReservationInput = {
  scheduleId: number;
  laboratoryId: number;
  reservationType?: ReservationType;
  pcId?: number | null;
  purpose: string;
  startTime: string;
  endTime: string;
};

type ReviewReservationInput = {
  status: "APPROVED" | "REJECTED";
  remarks?: string;
};

type CurrentUser = {
  id: number;
  role: UserRole;
};

type ConflictCheckInput = {
  laboratoryId: number;
  reservationDate: string | Date;
  startTime: string;
  endTime: string;
  reservationType: ReservationType;
  pcId?: number | null;
  excludeReservationId?: number;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

const activeReservationStatuses: ReservationStatus[] = ["PENDING", "APPROVED", "COMPLETED"];

export class ReservationService {
  private readonly laboratoryService: LaboratoryService;
  private readonly scheduleService: ScheduleService;
  private readonly staffAccessService: StaffAccessService;

  constructor(private readonly db: PrismaClient) {
    this.laboratoryService = new LaboratoryService(db);
    this.scheduleService = new ScheduleService(db);
    this.staffAccessService = new StaffAccessService(db);
  }

  async listReservations(currentUser: CurrentUser) {
    const where =
      currentUser.role === "STUDENT"
        ? { studentId: currentUser.id }
        : currentUser.role === "LABORATORY_STAFF"
          ? {
              laboratoryId: {
                in: await this.staffAccessService.getAssignedLabIds(currentUser.id)
              }
            }
          : undefined;

    return this.db.reservation.findMany({
      where,
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
        pc: true,
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

    const reservationType = input.reservationType ?? "LAB";
    const pc = await this.resolveReservationPc(input.laboratoryId, reservationType, input.pcId);

    const createdReservation = await this.db.$transaction(async (tx) => {
      await this.lockLaboratoryReservations(tx, input.laboratoryId);
      await this.ensureNoReservationConflict(
        {
          laboratoryId: input.laboratoryId,
          reservationDate: schedule.date,
          startTime: input.startTime,
          endTime: input.endTime,
          reservationType,
          pcId: pc?.id
        },
        tx
      );

      const reservation = await tx.reservation.create({
        data: {
          reservationCode: "PENDING-CODE",
          studentId,
          laboratoryId: input.laboratoryId,
          scheduleId: schedule.id,
          pcId: pc?.id ?? null,
          reservationType,
          purpose: input.purpose,
          reservationDate: toDateOnly(schedule.date),
          startTime: input.startTime,
          endTime: input.endTime
        }
      });

      const reservationCode = formatReservationCode(reservation.id);

      const createdReservation = await tx.reservation.update({
        where: { id: reservation.id },
        data: {
          reservationCode
        },
        include: {
          laboratory: true,
          pc: true,
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

      await this.logReservationAction(tx, {
        userId: studentId,
        reservationId: createdReservation.id,
        laboratoryId: createdReservation.laboratoryId,
        pcId: createdReservation.pcId,
        action: "CREATE_RESERVATION",
        description: `Submitted ${createdReservation.reservationType === "PC" ? "PC" : "laboratory"} reservation ${createdReservation.reservationCode}.`,
        metadata: {
          reservationType: createdReservation.reservationType,
          pcId: createdReservation.pcId
        }
      });

      return createdReservation;
    });

    notificationEventBus.publish("reservation.created", {
      reservationId: createdReservation.id,
      actorUserId: studentId
    });

    return createdReservation;
  }

  async cancelReservation(reservationId: number, studentId: number) {
    const updatedReservation = await this.db.$transaction(async (tx) => {
      const reservationRecord = await tx.reservation.findUnique({
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

      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date()
        }
      });

      await this.logReservationAction(tx, {
        userId: studentId,
        reservationId: updatedReservation.id,
        laboratoryId: updatedReservation.laboratoryId,
        pcId: updatedReservation.pcId,
        action: "CANCEL_RESERVATION",
        description: `Cancelled reservation ${updatedReservation.reservationCode}.`
      });

      return updatedReservation;
    });

    notificationEventBus.publish("reservation.cancelled", {
      reservationId: updatedReservation.id,
      actorUserId: studentId
    });

    return updatedReservation;
  }

  async reviewReservation(
    reservationId: number,
    input: ReviewReservationInput,
    currentUser: CurrentUser
  ) {
    const updatedReservation = await this.db.$transaction(async (tx) => {
      const [reviewer, reservationRecord] = await Promise.all([
        tx.user.findUnique({ where: { id: currentUser.id } }),
        tx.reservation.findUnique({
          where: { id: reservationId },
          include: {
            laboratory: true,
            pc: true
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

      await this.staffAccessService.ensureCanManageLab(currentUser, reservationRecord.laboratoryId);

      const reservation = new Reservation(reservationRecord);

      if (!reservation.isPending()) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Only pending reservations can be reviewed."
        );
      }

      if (input.status === "APPROVED") {
        await this.lockLaboratoryReservations(tx, reservationRecord.laboratoryId);
        await this.ensureNoReservationConflict(
          {
            laboratoryId: reservationRecord.laboratoryId,
            reservationDate: reservationRecord.reservationDate,
            startTime: reservationRecord.startTime,
            endTime: reservationRecord.endTime,
            reservationType: reservationRecord.reservationType,
            pcId: reservationRecord.pcId,
            excludeReservationId: reservationRecord.id
          },
          tx
        );
      }

      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: input.status,
          remarks: input.remarks ?? null,
          reviewedById: currentUser.id,
          reviewedAt: new Date()
        },
        include: {
          laboratory: true,
          pc: true,
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

      const reviewAction =
        input.status === "APPROVED" ? "APPROVE_RESERVATION" : "REJECT_RESERVATION";

      await this.logReservationAction(tx, {
        userId: currentUser.id,
        reservationId: updatedReservation.id,
        laboratoryId: updatedReservation.laboratoryId,
        pcId: updatedReservation.pcId,
        action: reviewAction,
        description: `${input.status === "APPROVED" ? "Approved" : "Rejected"} reservation ${updatedReservation.reservationCode}.`,
        metadata: {
          reservationType: updatedReservation.reservationType
        }
      });

      if (currentUser.role === "ADMIN") {
        await this.logReservationAction(tx, {
          userId: currentUser.id,
          reservationId: updatedReservation.id,
          laboratoryId: updatedReservation.laboratoryId,
          pcId: updatedReservation.pcId,
          action: "ADMIN_OVERRIDE_RESERVATION",
          description: `Admin ${input.status === "APPROVED" ? "approved" : "rejected"} reservation ${updatedReservation.reservationCode}.`,
          metadata: {
            overrideAction: reviewAction,
            reservationType: updatedReservation.reservationType
          }
        });
      }

      return updatedReservation;
    });

    if (updatedReservation.status === "APPROVED") {
      notificationEventBus.publish("reservation.confirmed", {
        reservationId: updatedReservation.id,
        actorUserId: currentUser.id
      });
    }

    return updatedReservation;
  }

  async completeReservation(reservationId: number, currentUser: CurrentUser, remarks?: string) {
    return this.db.$transaction(async (tx) => {
      const [reviewer, reservationRecord] = await Promise.all([
        tx.user.findUnique({ where: { id: currentUser.id } }),
        tx.reservation.findUnique({
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

      await this.staffAccessService.ensureCanManageLab(currentUser, reservationRecord.laboratoryId);

      const reservation = new Reservation(reservationRecord);

      if (!reservation.canBeCompleted()) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Only approved reservations can be marked as completed."
        );
      }

      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "COMPLETED",
          remarks: remarks ?? reservationRecord.remarks,
          reviewedById: currentUser.id,
          reviewedAt: new Date()
        }
      });

      await this.logReservationAction(tx, {
        userId: currentUser.id,
        reservationId: updatedReservation.id,
        laboratoryId: updatedReservation.laboratoryId,
        pcId: updatedReservation.pcId,
        action: "COMPLETE_RESERVATION",
        description: `Marked reservation ${updatedReservation.reservationCode} as completed.`
      });

      if (currentUser.role === "ADMIN") {
        await this.logReservationAction(tx, {
          userId: currentUser.id,
          reservationId: updatedReservation.id,
          laboratoryId: updatedReservation.laboratoryId,
          pcId: updatedReservation.pcId,
          action: "ADMIN_OVERRIDE_RESERVATION",
          description: `Admin completed reservation ${updatedReservation.reservationCode}.`,
          metadata: {
            overrideAction: "COMPLETE_RESERVATION"
          }
        });
      }

      return updatedReservation;
    });
  }

  private validateTimeRange(startTime: string, endTime: string) {
    if (!isValidTimeRange(startTime, endTime)) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Reservation end time must be later than the start time."
      );
    }
  }

  async ensureNoReservationConflict(input: ConflictCheckInput, dbClient: DbClient = this.db) {
    const overlappingWhere: Prisma.ReservationWhereInput = {
      laboratoryId: input.laboratoryId,
      reservationDate: toDateOnly(input.reservationDate),
      status: {
        in: activeReservationStatuses
      },
      startTime: {
        lt: input.endTime
      },
      endTime: {
        gt: input.startTime
      },
      ...(input.excludeReservationId ? { id: { not: input.excludeReservationId } } : {})
    };

    const blockingReservation =
      input.reservationType === "LAB"
        ? await dbClient.reservation.findFirst({
            where: overlappingWhere,
            select: {
              id: true,
              reservationCode: true,
              startTime: true,
              endTime: true,
              reservationType: true,
              pcId: true
            },
            orderBy: [{ startTime: "asc" }]
          })
        : await dbClient.reservation.findFirst({
            where: {
              ...overlappingWhere,
              OR: [{ reservationType: "LAB" }, { pcId: input.pcId ?? 0 }]
            },
            select: {
              id: true,
              reservationCode: true,
              startTime: true,
              endTime: true,
              reservationType: true,
              pcId: true
            },
            orderBy: [{ startTime: "asc" }]
          });

    if (!blockingReservation) {
      return;
    }

    if (input.reservationType === "LAB") {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `This laboratory already has reservation ${blockingReservation.reservationCode} from ${blockingReservation.startTime} to ${blockingReservation.endTime} on ${toDateOnly(input.reservationDate).toISOString().slice(0, 10)}. Choose another open time slot.`
      );
    }

    if (blockingReservation.reservationType === "LAB") {
      throw new ApiError(
        StatusCodes.CONFLICT,
        `The entire laboratory is already reserved under ${blockingReservation.reservationCode} from ${blockingReservation.startTime} to ${blockingReservation.endTime}.`
      );
    }

    throw new ApiError(
      StatusCodes.CONFLICT,
      `This PC is already reserved under ${blockingReservation.reservationCode} from ${blockingReservation.startTime} to ${blockingReservation.endTime}.`
    );
  }

  private async lockLaboratoryReservations(tx: Prisma.TransactionClient, laboratoryId: number) {
    const laboratories = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM Laboratory
      WHERE id = ${laboratoryId}
      FOR UPDATE
    `;

    if (laboratories.length === 0) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }
  }

  private async logReservationAction(
    dbClient: DbClient,
    input: {
      userId: number;
      reservationId: number;
      laboratoryId: number;
      pcId?: number | null;
      action: string;
      description: string;
      metadata?: Prisma.InputJsonValue;
    }
  ) {
    const activityLogService = new ActivityLogService(dbClient);

    await activityLogService.logActivity({
      userId: input.userId,
      labId: input.laboratoryId,
      pcId: input.pcId ?? null,
      action: input.action,
      entityType: "RESERVATION",
      entityId: input.reservationId,
      description: input.description,
      metadata: input.metadata
    });
  }

  private async resolveReservationPc(
    laboratoryId: number,
    reservationType: ReservationType,
    pcId?: number | null
  ) {
    if (reservationType === "LAB") {
      return null;
    }

    if (!pcId) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Select a PC when creating a PC reservation."
      );
    }

    const pc = await this.db.pC.findFirst({
      where: {
        id: pcId,
        laboratoryId
      }
    });

    if (!pc) {
      throw new ApiError(StatusCodes.NOT_FOUND, "The selected PC does not belong to this laboratory.");
    }

    if (pc.status !== "AVAILABLE") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "The selected PC is not currently available for reservations."
      );
    }

    return pc;
  }
}
