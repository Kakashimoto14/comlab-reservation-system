import type {
  Notification,
  NotificationChannel,
  NotificationType,
  Prisma,
  PrismaClient
} from "@prisma/client";

import { env } from "../config/env.js";
import {
  notificationEventBus,
  type NotificationEventBus,
  type NotificationEventPayload
} from "../notifications/NotificationEventBus.js";
import { combineDateAndTime } from "../utils/time.js";
import { EmailService } from "./EmailService.js";
import { buildEmailTextDetails, renderComportEmail } from "./emailTemplates.js";
import { notificationRealtimeService } from "./NotificationRealtimeService.js";

type ReservationNotificationContext = Prisma.ReservationGetPayload<{
  include: {
    student: {
      select: {
        id: true;
        email: true;
        firstName: true;
        lastName: true;
        studentNumber: true;
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
  firstName: string;
  lastName: string;
};

type ReservationEmailPayload = {
  subject: string;
  text: string;
  html: string;
  inAppMessage: string;
};

type ReservationDetail = {
  label: string;
  value: string;
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
      eventBus.subscribe("reservation.rejected", (payload) =>
        this.handleReservationRejected(payload)
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

    if (!reservation) {
      return;
    }

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_CREATED",
      email: this.buildStudentSubmittedEmail(reservation)
    });

    const staffRecipients = await this.resolveStaffRecipients(reservation);

    await Promise.all(
      staffRecipients.map((recipient) =>
        this.notifyRecipient({
          recipient,
          reservation,
          type: "RESERVATION_CREATED",
          email: this.buildStaffSubmittedEmail(reservation, recipient)
        })
      )
    );
  }

  private async handleReservationConfirmed(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);

    if (!reservation) {
      return;
    }

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_CONFIRMED",
      email: this.buildApprovedEmail(reservation)
    });
  }

  private async handleReservationRejected(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);

    if (!reservation) {
      return;
    }

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_REJECTED",
      email: this.buildRejectedEmail(reservation)
    });
  }

  private async handleReservationCancelled(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);

    if (!reservation) {
      return;
    }

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_CANCELLED",
      email: this.buildCancelledStudentEmail(reservation)
    });

    const staffRecipients = await this.resolveStaffRecipients(reservation);

    await Promise.all(
      staffRecipients.map((recipient) =>
        this.notifyRecipient({
          recipient,
          reservation,
          type: "RESERVATION_CANCELLED",
          email: this.buildCancelledStaffEmail(reservation, recipient)
        })
      )
    );
  }

  private async handleReservationReminder(payload: NotificationEventPayload) {
    const reservation = await this.loadReservationContext(payload.reservationId);

    if (!reservation) {
      return;
    }

    const startAt = combineDateAndTime(reservation.reservationDate, reservation.startTime);
    const minutesUntilStart = Math.max(1, startAt.diff(new Date(), "minute"));

    await this.notifyRecipient({
      recipient: this.toRecipient(reservation.student),
      reservation,
      type: "RESERVATION_REMINDER",
      email: this.buildReminderEmail(reservation, minutesUntilStart)
    });
  }

  private async notifyRecipient(input: {
    recipient: NotificationRecipient;
    reservation: ReservationNotificationContext;
    type: NotificationType;
    email: ReservationEmailPayload;
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
          subject: input.email.subject,
          message: input.email.inAppMessage,
          metadata
        },
        update: {
          status: "PENDING",
          subject: input.email.subject,
          message: input.email.inAppMessage,
          metadata,
          sentAt: null
        }
      });

      try {
        await this.emailService.sendMail({
          to: input.recipient.email,
          subject: input.email.subject,
          text: input.email.text,
          html: input.email.html
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

        console.error(
          `[notification] Email delivery failed for ${input.type} to ${input.recipient.email}.`,
          error
        );
      }
    }

    const inAppAlreadySent = await this.hasDeliveredNotification(
      input.recipient.userId,
      input.reservation.id,
      "IN_APP",
      input.type
    );

    if (!inAppAlreadySent) {
      const inAppNotification = await this.db.notification.upsert({
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
          subject: input.email.subject,
          message: input.email.inAppMessage,
          metadata,
          sentAt: new Date()
        },
        update: {
          status: "SENT",
          subject: input.email.subject,
          message: input.email.inAppMessage,
          metadata,
          sentAt: new Date()
        }
      });

      this.broadcastInAppNotification(inAppNotification);
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

  private broadcastInAppNotification(notification: Notification) {
    notificationRealtimeService.publishToUser(notification.userId, notification);
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
            lastName: true,
            studentNumber: true
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
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName
    };
  }

  private async resolveStaffRecipients(reservation: ReservationNotificationContext) {
    if (reservation.laboratory.custodian) {
      return [this.toRecipient(reservation.laboratory.custodian)];
    }

    const users = await this.db.user.findMany({
      where: {
        status: "ACTIVE",
        role: {
          in: ["ADMIN", "LABORATORY_STAFF"]
        }
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true
      }
    });

    return users.map((user) => this.toRecipient(user));
  }

  private buildStudentSubmittedEmail(
    reservation: ReservationNotificationContext
  ): ReservationEmailPayload {
    const details = this.buildReservationDetails(reservation, {
      includeStatus: true,
      statusLabel: "Pending approval"
    });
    const actionUrl = this.buildStudentReservationUrl();

    return this.buildEmailPackage({
      subject: "Your ComPort reservation has been submitted",
      preheader: `${reservation.reservationCode} is pending approval.`,
      eyebrow: "Reservation submitted",
      title: "Reservation request received",
      greeting: `Hello ${reservation.student.firstName},`,
      intro:
        "Your reservation request has been submitted successfully and is now waiting for laboratory staff approval.",
      body: [
        "You can review the request details anytime from your reservation history in ComPort."
      ],
      actionLabel: "View your reservation",
      actionUrl,
      details,
      inAppMessage: `Your reservation ${reservation.reservationCode} has been submitted and is pending approval.`
    });
  }

  private buildStaffSubmittedEmail(
    reservation: ReservationNotificationContext,
    recipient: NotificationRecipient
  ): ReservationEmailPayload {
    const details = [
      {
        label: "Student",
        value: `${reservation.student.firstName} ${reservation.student.lastName}`
      },
      ...(reservation.student.studentNumber
        ? [{ label: "Student ID", value: reservation.student.studentNumber }]
        : []),
      { label: "Student email", value: reservation.student.email },
      ...this.buildReservationDetails(reservation, {
        includeStatus: true,
        statusLabel: "Pending approval"
      })
    ];

    return this.buildEmailPackage({
      subject: "New ComPort reservation request",
      preheader: `${reservation.student.firstName} ${reservation.student.lastName} submitted ${reservation.reservationCode}.`,
      eyebrow: "Review required",
      title: "A new reservation needs review",
      greeting: `Hello ${recipient.firstName},`,
      intro:
        "A new reservation request was submitted in ComPort and is ready for staff review.",
      body: [
        "Open the reservation management page to approve or reject the request."
      ],
      actionLabel: "Review reservation",
      actionUrl: this.buildStaffReservationUrl(),
      details,
      inAppMessage: `${reservation.student.firstName} ${reservation.student.lastName} submitted reservation ${reservation.reservationCode} for review.`
    });
  }

  private buildApprovedEmail(reservation: ReservationNotificationContext): ReservationEmailPayload {
    const reviewerName = reservation.reviewedBy
      ? `${reservation.reviewedBy.firstName} ${reservation.reviewedBy.lastName}`
      : "the laboratory team";
    const details = this.buildReservationDetails(reservation, {
      includeStatus: true,
      statusLabel: "Approved"
    });

    return this.buildEmailPackage({
      subject: "Your ComPort reservation has been approved",
      preheader: `${reservation.reservationCode} has been approved.`,
      eyebrow: "Reservation approved",
      title: "Your reservation is approved",
      greeting: `Hello ${reservation.student.firstName},`,
      intro: `Your reservation request has been approved by ${reviewerName}.`,
      body: [
        "Please arrive on time and coordinate with the laboratory staff if you need any room or PC-specific assistance."
      ],
      actionLabel: "View your reservation",
      actionUrl: this.buildStudentReservationUrl(),
      details,
      inAppMessage: `Your reservation ${reservation.reservationCode} has been approved.`
    });
  }

  private buildRejectedEmail(reservation: ReservationNotificationContext): ReservationEmailPayload {
    const details = this.buildReservationDetails(reservation, {
      includeStatus: true,
      statusLabel: "Rejected",
      includeRemarks: true
    });

    return this.buildEmailPackage({
      subject: "Your ComPort reservation was not approved",
      preheader: `${reservation.reservationCode} was not approved.`,
      eyebrow: "Reservation update",
      title: "Your reservation was not approved",
      greeting: `Hello ${reservation.student.firstName},`,
      intro:
        "Your reservation request could not be approved at this time. Please review the details below before submitting another request.",
      body: [
        "If you need clarification, contact your laboratory staff or administrator through the usual school support channel."
      ],
      actionLabel: "View your reservation",
      actionUrl: this.buildStudentReservationUrl(),
      details,
      inAppMessage: `Your reservation ${reservation.reservationCode} was not approved.`
    });
  }

  private buildCancelledStudentEmail(
    reservation: ReservationNotificationContext
  ): ReservationEmailPayload {
    const details = this.buildReservationDetails(reservation, {
      includeStatus: true,
      statusLabel: "Cancelled"
    });

    return this.buildEmailPackage({
      subject: "Your ComPort reservation has been cancelled",
      preheader: `${reservation.reservationCode} has been cancelled.`,
      eyebrow: "Reservation cancelled",
      title: "Reservation cancelled",
      greeting: `Hello ${reservation.student.firstName},`,
      intro: "Your reservation request has been cancelled successfully.",
      body: [
        "If you still need laboratory access, you can submit a new request from ComPort."
      ],
      actionLabel: "View your reservations",
      actionUrl: this.buildStudentReservationUrl(),
      details,
      inAppMessage: `Your reservation ${reservation.reservationCode} has been cancelled.`
    });
  }

  private buildCancelledStaffEmail(
    reservation: ReservationNotificationContext,
    recipient: NotificationRecipient
  ): ReservationEmailPayload {
    const details = [
      {
        label: "Student",
        value: `${reservation.student.firstName} ${reservation.student.lastName}`
      },
      ...(reservation.student.studentNumber
        ? [{ label: "Student ID", value: reservation.student.studentNumber }]
        : []),
      ...this.buildReservationDetails(reservation, {
        includeStatus: true,
        statusLabel: "Cancelled"
      })
    ];

    return this.buildEmailPackage({
      subject: "A ComPort reservation has been cancelled",
      preheader: `${reservation.reservationCode} has been cancelled by the student.`,
      eyebrow: "Reservation cancelled",
      title: "A reservation was cancelled",
      greeting: `Hello ${recipient.firstName},`,
      intro:
        "A student cancelled a reservation request in ComPort. The details are listed below for your records.",
      actionLabel: "Open reservation management",
      actionUrl: this.buildStaffReservationUrl(),
      details,
      inAppMessage: `${reservation.student.firstName} ${reservation.student.lastName} cancelled reservation ${reservation.reservationCode}.`
    });
  }

  private buildReminderEmail(
    reservation: ReservationNotificationContext,
    minutesUntilStart: number
  ): ReservationEmailPayload {
    const details = this.buildReservationDetails(reservation, {
      includeStatus: true,
      statusLabel: "Approved"
    });

    return this.buildEmailPackage({
      subject: `Reminder: your ComPort reservation starts in about ${minutesUntilStart} minute${minutesUntilStart === 1 ? "" : "s"}`,
      preheader: `${reservation.reservationCode} starts soon.`,
      eyebrow: "Reservation reminder",
      title: "Your reservation starts soon",
      greeting: `Hello ${reservation.student.firstName},`,
      intro: `This is a reminder that your reservation starts in about ${minutesUntilStart} minute${minutesUntilStart === 1 ? "" : "s"}.`,
      actionLabel: "View your reservation",
      actionUrl: this.buildStudentReservationUrl(),
      details,
      inAppMessage: `Reminder: reservation ${reservation.reservationCode} starts in about ${minutesUntilStart} minute${minutesUntilStart === 1 ? "" : "s"}.`
    });
  }

  private buildEmailPackage(input: {
    subject: string;
    preheader: string;
    eyebrow: string;
    title: string;
    greeting: string;
    intro: string;
    body?: string[];
    actionLabel: string;
    actionUrl: string;
    details: ReservationDetail[];
    inAppMessage: string;
  }): ReservationEmailPayload {
    const detailLines = buildEmailTextDetails(input.details);
    const text = [
      input.greeting,
      "",
      input.intro,
      ...(input.body?.length ? ["", ...input.body] : []),
      "",
      ...detailLines,
      "",
      `${input.actionLabel}: ${input.actionUrl}`,
      "",
      "This is an automated message from ComPort. Please do not reply."
    ].join("\n");

    return {
      subject: input.subject,
      text,
      html: renderComportEmail({
        preheader: input.preheader,
        eyebrow: input.eyebrow,
        title: input.title,
        greeting: input.greeting,
        intro: input.intro,
        body: input.body,
        action: {
          label: input.actionLabel,
          url: input.actionUrl
        },
        details: input.details
      }),
      inAppMessage: input.inAppMessage
    };
  }

  private buildReservationDetails(
    reservation: ReservationNotificationContext,
    options: {
      includeStatus?: boolean;
      statusLabel?: string;
      includeRemarks?: boolean;
    } = {}
  ): ReservationDetail[] {
    return [
      { label: "Reservation code", value: reservation.reservationCode },
      { label: "Laboratory", value: this.buildLaboratoryLabel(reservation) },
      { label: "Date", value: this.formatReservationDate(reservation.reservationDate) },
      { label: "Time slot", value: this.formatTimeRange(reservation.startTime, reservation.endTime) },
      { label: "Reservation type", value: this.buildReservationTypeLabel(reservation) },
      { label: "Purpose", value: this.formatPurpose(reservation.purpose) },
      ...(options.includeStatus
        ? [{ label: "Status", value: options.statusLabel ?? this.formatStatus(reservation.status) }]
        : []),
      ...(options.includeRemarks && reservation.remarks
        ? [{ label: "Remarks", value: reservation.remarks }]
        : [])
    ];
  }

  private buildLaboratoryLabel(reservation: ReservationNotificationContext) {
    return `${reservation.laboratory.name} (${reservation.laboratory.roomCode})`;
  }

  private buildReservationTypeLabel(reservation: ReservationNotificationContext) {
    if (reservation.reservationType === "PC" && reservation.pc?.pcNumber) {
      return `PC reservation (${reservation.pc.pcNumber})`;
    }

    return "Laboratory reservation";
  }

  private formatPurpose(purpose: string) {
    const normalized = purpose.trim();
    return normalized.length ? normalized : "Not provided";
  }

  private formatStatus(status: ReservationNotificationContext["status"]) {
    return status.charAt(0) + status.slice(1).toLowerCase();
  }

  private formatReservationDate(value: Date) {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "full",
      timeZone: "UTC"
    }).format(value);
  }

  private formatTimeRange(startTime: string, endTime: string) {
    return `${this.formatTime(startTime)} to ${this.formatTime(endTime)}`;
  }

  private formatTime(value: string) {
    const [hoursString, minutesString] = value.split(":");
    const hours = Number(hoursString);
    const minutes = Number(minutesString);
    const period = hours >= 12 ? "PM" : "AM";
    const normalizedHours = hours % 12 || 12;
    const normalizedMinutes = minutes.toString().padStart(2, "0");

    return `${normalizedHours}:${normalizedMinutes} ${period}`;
  }

  private buildStudentReservationUrl() {
    return `${env.FRONTEND_URL.replace(/\/$/, "")}/student/reservations`;
  }

  private buildStaffReservationUrl() {
    return `${env.FRONTEND_URL.replace(/\/$/, "")}/management/reservations`;
  }
}
