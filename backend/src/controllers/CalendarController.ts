import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { CalendarService } from "../services/CalendarService.js";

const calendarService = new CalendarService(prisma);

export class CalendarController {
  static async list(req: Request, res: Response) {
    const data = await calendarService.listCalendar({
      laboratoryId: req.query.laboratoryId ? Number(req.query.laboratoryId) : undefined,
      date: req.query.date ? String(req.query.date) : undefined
    });

    res.status(StatusCodes.OK).json(data);
  }

  static async create(req: Request, res: Response) {
    const event = await calendarService.createCalendarEvent(req.body, req.authUser!.id);
    res.status(StatusCodes.CREATED).json(event);
  }

  static async update(req: Request, res: Response) {
    const event = await calendarService.updateCalendarEvent(
      Number(req.params.id),
      req.body,
      req.authUser!.id
    );

    res.status(StatusCodes.OK).json(event);
  }

  static async remove(req: Request, res: Response) {
    await calendarService.deleteCalendarEvent(Number(req.params.id), req.authUser!.id);
    res.status(StatusCodes.OK).json({
      message: "Calendar event deleted successfully."
    });
  }
}
