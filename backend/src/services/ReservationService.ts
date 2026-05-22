import type {
  Prisma,
  PrismaClient,
  ReservationStatus,
  ReservationType,
  UserRole
} from "@prisma/client";
import { randomUUID } from "crypto";
import { StatusCodes } from "http-status-codes";

import { env } from "../config/env.js";
import { Reservation } from "../domain/Reservation.js";
import { notificationEventBus } from "../notifications/NotificationEventBus.js";
import { UserFactory } from "../domain/UserFactory.js";
import { ApiError } from "../utils/ApiError.js";
import { formatReservationCode, isValidTimeRange, toDateOnly } from "../utils/time.js";
import { ActivityLogService } from "./ActivityLogService.js";
import { GoogleCalendarService, type GoogleCalendarSyncResult } from "./GoogleCalendarService.js";
import { LaboratoryService } from "./LaboratoryService.js";
import {
  NotificationService,
  type ReservationNotificationResult
} from "./NotificationService.js";
import { notificationRealtimeService } from "./NotificationRealtimeService.js";
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
const reservationTransactionOptions = {
  maxWait: 10_000,
  timeout: 20_000
};
const reservationListInclude = {
  laboratory: {
    select: {
      id: true,
      name: true,
      roomCode: true,
      status: true
    }
  },
  pc: {
    select: {
      id: true,
      pcNumber: true,
      status: true
    }
  },
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
} satisfies Prisma.ReservationInclude;

type ReservationListRecord = Prisma.ReservationGetPayload<{
  include: typeof reservationListInclude;
}>;

export class ReservationService {
  private readonly laboratoryService: LaboratoryService;
  private readonly scheduleService: ScheduleService;
  private readonly staffAccessService: StaffAccessService;
  private readonly googleCalendarService: GoogleCalendarService;
  private readonly notificationService: NotificationService;

  constructor(private readonly db: PrismaClient) {
    this.laboratoryService = new LaboratoryService(db);
    this.scheduleService = new ScheduleService(db);
    this.staffAccessService = new StaffAccessService(db);
    this.googleCalendarService = new GoogleCalendarService();
    this.notificationService = new NotificationService(db);
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

    const reservations = await this.db.reservation.findMany({
      where,
      include: reservationListInclude,
      orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }]
    });

    return reservations.map((reservation) => this.normalizeReservationForResponse(reservation));
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

    const reservationType = input.reservationType ?? "LAB";

    const createdReservation = await this.runTransaction(async (tx) => {
      await this.lockLaboratoryReservations(tx, input.laboratoryId);
      const schedule = await this.lockAndLoadSchedule(tx, input.scheduleId);

      this.scheduleService.validateScheduleRecord(schedule);

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

      const pc = await this.resolveReservationPc(
        input.laboratoryId,
        reservationType,
        input.pcId,
        tx
      );

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
          reservationCode: this.buildPendingReservationCode(),
          studentId,
          laboratoryId: input.laboratoryId,
          scheduleId: input.scheduleId,
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
        include: reservationListInclude
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
    await this.publishReservationRealtimeUpdate(
      createdReservation.id,
      "reservation.created",
      studentId
    );

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
    await this.publishReservationRealtimeUpdate(
      updatedReservation.id,
      "reservation.cancelled",
      studentId
    );

    return updatedReservation;
  }

  async reviewReservation(
    reservationId: number,
    input: ReviewReservationInput,
    currentUser: CurrentUser
  ) {
    const [reviewer, reservationRecord] = await Promise.all([
      this.db.user.findUnique({ where: { id: currentUser.id } }),
      this.db.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          laboratoryId: true,
          reservationDate: true,
          startTime: true,
          endTime: true,
          reservationType: true,
          pcId: true,
          status: true
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

    if (reservationRecord.status !== "PENDING") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Only pending reservations can be reviewed."
      );
    }

    const updatedReservation = await this.runTransaction(async (tx) => {
      await this.lockLaboratoryReservations(tx, reservationRecord.laboratoryId);

      const currentReservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          laboratoryId: true,
          reservationDate: true,
          startTime: true,
          endTime: true,
          reservationType: true,
          pcId: true,
          status: true
        }
      });

      if (!currentReservation) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Reservation not found.");
      }

      if (currentReservation.status !== "PENDING") {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Only pending reservations can be reviewed."
        );
      }

      if (input.status === "APPROVED") {
        await this.ensureNoReservationConflict(
          {
            laboratoryId: currentReservation.laboratoryId,
            reservationDate: currentReservation.reservationDate,
            startTime: currentReservation.startTime,
            endTime: currentReservation.endTime,
            reservationType: currentReservation.reservationType,
            pcId: currentReservation.pcId,
            excludeReservationId: currentReservation.id
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
        include: reservationListInclude
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

    await this.publishReservationRealtimeUpdate(
      updatedReservation.id,
      updatedReservation.status === "APPROVED"
        ? "reservation.approved"
        : "reservation.rejected",
      currentUser.id
    );

    if (updatedReservation.status === "APPROVED") {
      void this.processApprovedReservationSideEffects(updatedReservation.id, currentUser.id);

      const responseReservation = this.normalizeReservationForResponse(updatedReservation);

      return {
        ...responseReservation,
        message: env.GOOGLE_CALENDAR_ENABLED
          ? "Reservation approved. Email notification and calendar sync are processing in the background."
          : "Reservation approved successfully.",
        reservation: responseReservation,
        calendar: {
          status: env.GOOGLE_CALENDAR_ENABLED ? "skipped" : "disabled",
          message: env.GOOGLE_CALENDAR_ENABLED
            ? "Google Calendar sync is processing in the background."
            : "Google Calendar sync is disabled."
        }
      };
    }

    if (updatedReservation.status === "REJECTED") {
      void this.processRejectedReservationSideEffects(updatedReservation.id);

      const responseReservation = this.normalizeReservationForResponse(updatedReservation);

      return {
        ...responseReservation,
        message: "Reservation rejected successfully.",
        reservation: responseReservation
      };
    }

    return updatedReservation;
  }

  private async syncApprovedReservationToCalendar(
    reservation: Prisma.ReservationGetPayload<{ include: typeof reservationListInclude }>
  ) {
    const syncResult = await this.googleCalendarService.createReservationEvent(reservation);

    try {
      const updatedReservation = await this.saveCalendarSyncResult(
        reservation.id,
        syncResult
      );

      return {
        reservation: updatedReservation,
        message: syncResult.message,
        syncResult
      };
    } catch (error) {
      console.error("[calendar] Failed to save reservation calendar sync status.", {
        reservationId: reservation.id,
        reservationCode: reservation.reservationCode,
        error: error instanceof Error ? error.message : "Unknown persistence error."
      });

      return {
        reservation,
        message:
          "Reservation approved, but Google Calendar sync status could not be saved. Please check server logs.",
        syncResult
      };
    }
  }

  private saveCalendarSyncResult(
    reservationId: number,
    syncResult: GoogleCalendarSyncResult
  ) {
    return this.db.reservation.update({
      where: { id: reservationId },
      data: {
        googleCalendarEventId: syncResult.eventId,
        calendarSyncStatus: syncResult.status,
        calendarSyncError: syncResult.error,
        calendarSyncedAt: syncResult.syncedAt
      },
      include: reservationListInclude
    });
  }

  private async sendReviewNotification(
    reservationId: number,
    status: ReviewReservationInput["status"]
  ): Promise<ReservationNotificationResult> {
    try {
      return status === "APPROVED"
        ? await this.notificationService.notifyReservationConfirmed({ reservationId })
        : await this.notificationService.notifyReservationRejected({ reservationId });
    } catch (error) {
      console.error("[notification] Reservation review notification failed.", {
        reservationId,
        status,
        error: error instanceof Error ? error.message : "Unknown notification error."
      });

      return {
        email: "failed",
        realtime: "failed"
      };
    }
  }

  private async processApprovedReservationSideEffects(
    reservationId: number,
    actorUserId: number
  ) {
    try {
      const reservation = await this.db.reservation.findUnique({
        where: { id: reservationId },
        include: reservationListInclude
      });

      if (!reservation || reservation.status !== "APPROVED") {
        return;
      }

      const [calendarResult, notificationResult] = await Promise.allSettled([
        this.syncApprovedReservationToCalendar(reservation),
        this.sendReviewNotification(reservationId, "APPROVED")
      ]);

      if (calendarResult.status === "fulfilled") {
        await this.publishReservationRealtimeUpdate(
          calendarResult.value.reservation.id,
          "reservation.updated",
          actorUserId
        );
      } else {
        console.error("[calendar] Approved reservation background sync failed.", {
          reservationId,
          error:
            calendarResult.reason instanceof Error
              ? calendarResult.reason.message
              : "Unknown calendar background error."
        });
      }

      if (notificationResult.status === "rejected") {
        console.error("[notification] Approved reservation background notification failed.", {
          reservationId,
          error:
            notificationResult.reason instanceof Error
              ? notificationResult.reason.message
              : "Unknown notification background error."
        });
      }
    } catch (error) {
      console.error("[reservation] Approved reservation side effects failed.", {
        reservationId,
        error: error instanceof Error ? error.message : "Unknown side-effect error."
      });
    }
  }

  private async processRejectedReservationSideEffects(reservationId: number) {
    try {
      await this.sendReviewNotification(reservationId, "REJECTED");
    } catch (error) {
      console.error("[reservation] Rejected reservation side effects failed.", {
        reservationId,
        error: error instanceof Error ? error.message : "Unknown side-effect error."
      });
    }
  }

  private async publishReservationRealtimeUpdate(
    reservationId: number,
    eventName:
      | "reservation.created"
      | "reservation.updated"
      | "reservation.approved"
      | "reservation.rejected"
      | "reservation.cancelled"
      | "reservation.completed",
    actorUserId?: number
  ) {
    try {
      const reservation = await this.db.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          reservationCode: true,
          studentId: true,
          laboratoryId: true,
          status: true,
          updatedAt: true,
          calendarSyncStatus: true,
          laboratory: {
            select: {
              id: true,
              name: true,
              roomCode: true
            }
          }
        }
      });

      if (!reservation) {
        return;
      }

      const recipientIds = await this.resolveReservationRealtimeRecipients(
        reservation.studentId,
        reservation.laboratoryId
      );
      const payload = {
        type: eventName,
        reservationId: reservation.id,
        reservationCode: reservation.reservationCode,
        status: reservation.status,
        updatedAt: reservation.updatedAt.toISOString(),
        actorUserId,
        calendarSyncStatus: reservation.calendarSyncStatus,
        laboratory: reservation.laboratory
      };

      for (const userId of recipientIds) {
        notificationRealtimeService.publishEventToUser(userId, eventName, payload);
      }
    } catch (error) {
      console.error("[reservation] Failed to publish realtime reservation update.", {
        reservationId,
        eventName,
        error: error instanceof Error ? error.message : "Unknown realtime error."
      });
    }
  }

  private async resolveReservationRealtimeRecipients(studentId: number, laboratoryId: number) {
    const users = await this.db.user.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { id: studentId },
          { role: "ADMIN" },
          {
            role: "LABORATORY_STAFF",
            assignedLaboratories: {
              some: {
                id: laboratoryId
              }
            }
          }
        ]
      },
      select: {
        id: true
      }
    });

    return Array.from(new Set(users.map((user) => user.id)));
  }

  async completeReservation(reservationId: number, currentUser: CurrentUser, remarks?: string) {
    const [reviewer, reservationRecord] = await Promise.all([
      this.db.user.findUnique({ where: { id: currentUser.id } }),
      this.db.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          reservationCode: true,
          laboratoryId: true,
          pcId: true,
          status: true,
          remarks: true,
          reviewedById: true,
          reviewedAt: true,
          cancelledAt: true,
          studentId: true,
          scheduleId: true,
          reservationType: true,
          purpose: true,
          reservationDate: true,
          startTime: true,
          endTime: true,
          createdAt: true,
          updatedAt: true
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
        "Your role is not allowed to complete reservations."
      );
    }

    await this.staffAccessService.ensureCanManageLab(currentUser, reservationRecord.laboratoryId);

    if (reservationRecord.status !== "APPROVED") {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "Only approved reservations can be marked as completed."
      );
    }

    const updatedReservation = await this.runTransaction(async (tx) => {
      const currentReservation = await tx.reservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          reservationCode: true,
          laboratoryId: true,
          pcId: true,
          status: true,
          remarks: true,
          reviewedById: true,
          reviewedAt: true,
          cancelledAt: true,
          studentId: true,
          scheduleId: true,
          reservationType: true,
          purpose: true,
          reservationDate: true,
          startTime: true,
          endTime: true,
          createdAt: true,
          updatedAt: true
        }
      });

      if (!currentReservation) {
        throw new ApiError(StatusCodes.NOT_FOUND, "Reservation not found.");
      }

      if (currentReservation.status !== "APPROVED") {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "Only approved reservations can be marked as completed."
        );
      }

      const updatedReservation = await tx.reservation.update({
        where: { id: reservationId },
        data: {
          status: "COMPLETED",
          remarks: remarks ?? currentReservation.remarks,
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

    await this.publishReservationRealtimeUpdate(
      updatedReservation.id,
      "reservation.completed",
      currentUser.id
    );

    return updatedReservation;
  }

  private runTransaction<T>(callback: (tx: Prisma.TransactionClient) => Promise<T>) {
    return this.db.$transaction(callback, reservationTransactionOptions);
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
      FROM "Laboratory"
      WHERE id = ${laboratoryId}
      FOR UPDATE
    `;

    if (laboratories.length === 0) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Laboratory not found.");
    }
  }

  private async lockAndLoadSchedule(tx: Prisma.TransactionClient, scheduleId: number) {
    const scheduleRows = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT id
      FROM "Schedule"
      WHERE id = ${scheduleId}
      FOR UPDATE
    `;

    if (!scheduleRows.length) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    const schedule = await tx.schedule.findUnique({
      where: { id: scheduleId }
    });

    if (!schedule) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Schedule not found.");
    }

    return schedule;
  }

  private buildPendingReservationCode() {
    return `PENDING-${randomUUID()}`;
  }

  private normalizeReservationForResponse<T extends ReservationListRecord>(reservation: T): T {
    if (
      env.GOOGLE_CALENDAR_ENABLED ||
      reservation.status !== "APPROVED" ||
      reservation.calendarSyncStatus === "SYNCED"
    ) {
      return reservation;
    }

    return {
      ...reservation,
      googleCalendarEventId: null,
      calendarSyncStatus: "DISABLED",
      calendarSyncError: null,
      calendarSyncedAt: null
    };
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
    pcId?: number | null,
    dbClient: DbClient = this.db
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

    const pc = await dbClient.pC.findFirst({
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
