import type { PrismaClient } from "@prisma/client";
import dayjs from "dayjs";

import { env } from "../config/env.js";
import { notificationEventBus, type NotificationEventBus } from "../notifications/NotificationEventBus.js";
import { combineDateAndTime, toDateOnly } from "../utils/time.js";

export class ReservationReminderService {
  private interval?: NodeJS.Timeout;
  private isRunning = false;

  constructor(
    private readonly db: PrismaClient,
    private readonly eventBus: NotificationEventBus = notificationEventBus
  ) {}

  start() {
    if (this.interval) return;

    void this.runCycle();

    this.interval = setInterval(() => {
      void this.runCycle();
    }, env.RESERVATION_REMINDER_INTERVAL_MS);
  }

  stop() {
    if (!this.interval) return;

    clearInterval(this.interval);
    this.interval = undefined;
  }

  async runCycle(referenceTime = new Date()) {
    if (this.isRunning) return;

    this.isRunning = true;

    try {
      const reminderWindowEnd = dayjs(referenceTime)
        .add(env.RESERVATION_REMINDER_LEAD_MINUTES, "minute")
        .toDate();

      const reservations = await this.db.reservation.findMany({
        where: {
          status: "APPROVED",
          reservationDate: {
            gte: toDateOnly(referenceTime),
            lte: toDateOnly(reminderWindowEnd)
          },
          notifications: {
            none: {
              type: "RESERVATION_REMINDER"
            }
          }
        },
        select: {
          id: true,
          reservationDate: true,
          startTime: true
        }
      });

      for (const reservation of reservations) {
        const reservationStart = combineDateAndTime(
          reservation.reservationDate,
          reservation.startTime
        );

        if (
          reservationStart.isAfter(referenceTime) &&
          !reservationStart.isAfter(reminderWindowEnd)
        ) {
          this.eventBus.publish("reservation.reminder", {
            reservationId: reservation.id
          });
        }
      }
    } catch (error) {
      console.error(
        "[reminder] Failed to process reservation reminders.",
        error
      );
    } finally {
      this.isRunning = false;
    }
  }
}