import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { NotificationInboxService } from "../services/NotificationInboxService.js";
import { notificationRealtimeService } from "../services/NotificationRealtimeService.js";

const notificationInboxService = new NotificationInboxService(prisma);

export class NotificationController {
  static async list(req: Request, res: Response) {
    const unreadOnly = req.query.unreadOnly === "true";
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const data = await notificationInboxService.listNotifications(req.authUser!.id, {
      unreadOnly,
      limit
    });

    res.status(StatusCodes.OK).json(data);
  }

  static async markAsRead(req: Request, res: Response) {
    const notification = await notificationInboxService.markAsRead(
      req.authUser!.id,
      Number(req.params.id)
    );

    res.status(StatusCodes.OK).json(notification);
  }

  static async markAllAsRead(req: Request, res: Response) {
    const result = await notificationInboxService.markAllAsRead(req.authUser!.id);

    res.status(StatusCodes.OK).json(result);
  }

  static stream(req: Request, res: Response) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const cleanup = notificationRealtimeService.subscribe(req.authUser!.id, res);

    req.on("close", () => {
      cleanup();
      res.end();
    });
  }
}
