import type {
  NotificationChannel,
  NotificationType,
  Prisma,
  PrismaClient
} from "@prisma/client";

import { notificationEventBus, type NotificationEventBus, type NotificationEventPayload } from "../notifications/NotificationEventBus.js";
import { combineDateAndTime } from "../utils/time.js";
import { EmailService } from "./EmailService.js";

type ReservationNotificationContext = Prisma.ReservationGetPayload<{
  include: {
    student: {
      select: {
        id: true;
        email: true;
        firstName: true;
        lastName: true;
      };
    };
    reviewedBy: {
      select: {
        id: true;
        firstName: true;
        lastName: true;
      };
    };
    laboratory: {
      select: {
        id: true;
        name: true;
        roomCode: true;
        custodian: {
          select: {
            id: true;
            email: true;
            firstName: true;
            lastName: true;
          };
        };
      };
    };
    pc: {
      select: {
        id: true;
        pcNumber: true;
      };
    };
  };
}>;

type NotificationRecipient = {
  userId: number;
  email: string;
};

export class NotificationService {
  private unsubscribeHandlers: Array<() => void> = [];

  constructor(
    private readonly db: PrismaClient,
    private readonly emailService = new EmailService()
  ) {}

  register(eventBus: NotificationEventBus = notificationEventBus) {
    this.unregister();

    this.unsubscribeHandlers = [
      eventBus.subscribe("reservation.created", (payload) =>
        this.handleReservationCreated(payload)
      ),
      eventBus.subscribe("reservation.confirmed", (payload) =>
        this.handleReservationConfirmed(payload)
      ),
      eventBus.subscribe("reservation.cancelled", (payload) =>
        this.handleReservationCancelled(payload)
      ),
      eventBus.subscribe("reservation.reminder", (payload) =>
        this.handleReservationReminder(payload)
      )
    ];
  }

  unregister() {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
  }

  private async handleReservationCreated(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);
    if (!reservation) return;

    const reservationLabel = this.buildReservationLabel(reservation);
    const scheduleLabel = this.buildScheduleLabel(reservation);

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_CREATED",
      subject: `Reservation request received: ${reservation.reservationCode}`,
      message: `Your ${reservationLabel} reservation ${reservation.reservationCode} for ${scheduleLabel} has been submitted and is awaiting confirmation.`
    });

    if (reservation.laboratory.custodian) {
      await this.notifyRecipient({
        recipient: this.toRecipient(reservation.laboratory.custodian),
        reservation,
        type: "RESERVATION_CREATED",
        subject: `New reservation request: ${reservation.reservationCode}`,
        message: `${reservation.student.firstName} ${reservation.student.lastName} submitted ${reservationLabel} reservation ${reservation.reservationCode} for ${scheduleLabel}.`
      });
    }
  }

  private async handleReservationConfirmed(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);
    if (!reservation) return;

    const scheduleLabel = this.buildScheduleLabel(reservation);
    const reviewerName = reservation.reviewedBy
      ? `${reservation.reviewedBy.firstName} ${reservation.reviewedBy.lastName}`
      : "the laboratory team";

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_CONFIRMED",
      subject: `Reservation confirmed: ${reservation.reservationCode}`,
      message: `Your reservation ${reservation.reservationCode} for ${scheduleLabel} has been confirmed by ${reviewerName}.`
    });
  }

  private async handleReservationCancelled(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);
    if (!reservation) return;

    const reservationLabel = this.buildReservationLabel(reservation);
    const scheduleLabel = this.buildScheduleLabel(reservation);

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_CANCELLED",
      subject: `Reservation cancelled: ${reservation.reservationCode}`,
      message: `Your ${reservationLabel} reservation ${reservation.reservationCode} for ${scheduleLabel} has been cancelled.`
    });

    if (reservation.laboratory.custodian) {
      await this.notifyRecipient({
        recipient: this.toRecipient(reservation.laboratory.custodian),
        reservation,
        type: "RESERVATION_CANCELLED",
        subject: `Reservation cancelled: ${reservation.reservationCode}`,
        message: `${reservation.student.firstName} ${reservation.student.lastName} cancelled reservation ${reservation.reservationCode} for ${scheduleLabel}.`
      });
    }
  }

  private async handleReservationReminder(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);
    if (!reservation) return;

    const startAt = combineDateAndTime(reservation.reservationDate, reservation.startTime);
    const minutesUntilStart = Math.max(1, startAt.diff(new Date(), "minute"));

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_REMINDER",
      subject: `Reminder: reservation ${reservation.reservationCode} starts soon`,
      message: `Reminder: reservation ${reservation.reservationCode} for ${this.buildScheduleLabel(reservation)} starts in about ${minutesUntilStart} minute${minutesUntilStart === 1 ? "" : "s"}.`
    });
  }

  private async notifyRecipient(input: {
    recipient: NotificationRecipient;
    reservation: ReservationNotificationContext;
    type: NotificationType;
    subject: string;
    message: string;
  }) {
    const metadata: Prisma.InputJsonValue = {
      reservationCode: input.reservation.reservationCode,
      reservationStatus: input.reservation.status,
      laboratoryId: input.reservation.laboratoryId,
      scheduleId: input.reservation.scheduleId,
      reservationType: input.reservation.reservationType
    };

    const emailAlreadySent = await this.hasDeliveredNotification(
      input.recipient.userId,
      input.reservation.id,
      "EMAIL",
      input.type
    );

    if (!emailAlreadySent) {
      const emailNotification = await this.db.notification.upsert({
        where: {
          userId_reservationId_channel_type: {
            userId: input.recipient.userId,
            reservationId: input.reservation.id,
            channel: "EMAIL",
            type: input.type
          }
        },
        create: {
          userId: input.recipient.userId,
          reservationId: input.reservation.id,
          channel: "EMAIL",
          type: input.type,
          status: "PENDING",
          subject: input.subject,
          message: input.message,
          metadata
        },
        update: {
          status: "PENDING",
          subject: input.subject,
          message: input.message,
          metadata,
          sentAt: null
        }
      });

      try {
        await this.emailService.sendMail({
          to: input.recipient.email,
          subject: input.subject,
          text: input.message
        });

        await this.db.notification.update({
          where: { id: emailNotification.id },
          data: {
            status: "SENT",
            sentAt: new Date()
          }
        });
      } catch (error) {
        await this.db.notification.update({
          where: { id: emailNotification.id },
          data: {
            status: "FAILED",
            metadata: {
              ...((metadata as Record<string, unknown>) ?? {}),
              deliveryError: error instanceof Error ? error.message : "Unknown error"
            }
          }
        });

        console.error("[notification] Email failed", error);
      }
    }

    const inAppAlreadySent = await this.hasDeliveredNotification(
      input.recipient.userId,
      input.reservation.id,
      "IN_APP",
      input.type
    );

    if (!inAppAlreadySent) {
      await this.db.notification.upsert({
        where: {
          userId_reservationId_channel_type: {
            userId: input.recipient.userId,
            reservationId: input.reservation.id,
            channel: "IN_APP",
            type: input.type
          }
        },
        create: {
          userId: input.recipient.userId,
          reservationId: input.reservation.id,
          channel: "IN_APP",
          type: input.type,
          status: "SENT",
          subject: input.subject,
          message: input.message,
          metadata,
          sentAt: new Date()
        },
        update: {
          status: "SENT",
          subject: input.subject,
          message: input.message,
          metadata,
          sentAt: new Date()
        }
      });
    }
  }

  private async hasDeliveredNotification(
    userId: number,
    reservationId: number,
    channel: NotificationChannel,
    type: NotificationType
  ) {
    const notification = await this.db.notification.findUnique({
      where: {
        userId_reservationId_channel_type: {
          userId,
          reservationId,
          channel,
          type
        }
      },
      select: {
        id: true,
        status: true
      }
    });

    return notification?.status === "SENT";
  }

  private async loadReservationContext(reservationId: number) {
    return this.db.reservation.findUnique({
      where: { id: reservationId },
      include: {
        student: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true
          }
        },
        reviewedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true
          }
        },
        laboratory: {
          select: {
            id: true,
            name: true,
            roomCode: true,
            custodian: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true
              }
            }
          }
        },
        pc: {
          select: {
            id: true,
            pcNumber: true
          }
        }
      }
    });
  }

  private toRecipient(user: {
    id: number;
    email: string;
    firstName: string;
    lastName: string;
  }): NotificationRecipient {
    return {
      userId: user.id,
      email: user.email
    };
  }

  private buildScheduleLabel(reservation: ReservationNotificationContext) {
    const dateLabel = reservation.reservationDate.toISOString().slice(0, 10);
    return `${reservation.laboratory.name} (${reservation.laboratory.roomCode}) on ${dateLabel} from ${reservation.startTime} to ${reservation.endTime}`;
  }

  private buildReservationLabel(reservation: ReservationNotificationContext) {
    if (reservation.reservationType === "PC" && reservation.pc) {
      return `PC ${reservation.pc.pcNumber}`;
    }
    return "laboratory";
  }
}