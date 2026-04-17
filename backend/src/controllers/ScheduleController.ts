import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { ScheduleService } from "../services/ScheduleService.js";

const scheduleService = new ScheduleService(prisma);

export class ScheduleController {
  static async list(req: Request, res: Response) {
    const schedules = await scheduleService.listSchedules({
      laboratoryId: req.query.laboratoryId
        ? Number(req.query.laboratoryId)
        : undefined,
      date: req.query.date ? String(req.query.date) : undefined
    });

    res.status(StatusCodes.OK).json(schedules);
  }

  static async create(req: Request, res: Response) {
    const schedule = await scheduleService.createSchedule(req.body, req.authUser!.id);
    res.status(StatusCodes.CREATED).json(schedule);
  }

  static async update(req: Request, res: Response) {
    const schedule = await scheduleService.updateSchedule(
      Number(req.params.id),
      req.body,
      req.authUser!.id
    );

    res.status(StatusCodes.OK).json(schedule);
  }

  static async remove(req: Request, res: Response) {
    await scheduleService.deleteSchedule(Number(req.params.id), req.authUser!.id);
    res.status(StatusCodes.OK).json({
      message: "Schedule deleted successfully."
    });
  }
}
