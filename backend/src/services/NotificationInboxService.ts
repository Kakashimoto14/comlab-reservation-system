import { StatusCodes } from "http-status-codes";
import type { PrismaClient } from "@prisma/client";

import { ApiError } from "../utils/ApiError.js";

const MAX_NOTIFICATIONS_PER_PAGE = 50;

export class NotificationInboxService {
  constructor(private readonly db: PrismaClient) {}

  async listNotifications(userId: number, input?: { unreadOnly?: boolean; limit?: number }) {
    const requestedLimit = input?.limit;
    const take =
      requestedLimit && Number.isFinite(requestedLimit) && requestedLimit > 0
        ? Math.min(requestedLimit, MAX_NOTIFICATIONS_PER_PAGE)
        : 20;
    const where = {
      userId,
      channel: "IN_APP" as const,
      ...(input?.unreadOnly ? { readAt: null } : {})
    };

    const [items, unreadCount] = await Promise.all([
      this.db.notification.findMany({
        where,
        orderBy: [{ readAt: "asc" }, { createdAt: "desc" }],
        take
      }),
      this.db.notification.count({
        where: {
          userId,
          channel: "IN_APP",
          readAt: null
        }
      })
    ]);

    return {
      items,
      unreadCount
    };
  }

  async markAsRead(userId: number, notificationId: number) {
    const notification = await this.db.notification.findFirst({
      where: {
        id: notificationId,
        userId,
        channel: "IN_APP"
      }
    });

    if (!notification) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Notification not found.");
    }

    if (notification.readAt) {
      return notification;
    }

    return this.db.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date()
      }
    });
  }

  async markAllAsRead(userId: number) {
    const result = await this.db.notification.updateMany({
      where: {
        userId,
        channel: "IN_APP",
        readAt: null
      },
      data: {
        readAt: new Date()
      }
    });

    return {
      updatedCount: result.count
    };
  }
}
