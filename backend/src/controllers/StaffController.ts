import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { StaffService } from "../services/StaffService.js";

const staffService = new StaffService(prisma);

export class StaffController {
  static async getMyLab(req: Request, res: Response) {
    const laboratory = await staffService.getMyLab(req.authUser!.id);
    res.status(StatusCodes.OK).json(laboratory);
  }

  static async getMyLabReservations(req: Request, res: Response) {
    const reservations = await staffService.getMyLabReservations(req.authUser!.id);
    res.status(StatusCodes.OK).json(reservations);
  }

  static async getMyLabSchedules(req: Request, res: Response) {
    const schedules = await staffService.getMyLabSchedules(req.authUser!.id);
    res.status(StatusCodes.OK).json(schedules);
  }

  static async getMyLabLogs(req: Request, res: Response) {
    const logs = await staffService.getMyLabLogs(req.authUser!.id);
    res.status(StatusCodes.OK).json(logs);
  }

  static async getMyLabPcs(req: Request, res: Response) {
    const pcs = await staffService.getMyLabPcs(req.authUser!.id);
    res.status(StatusCodes.OK).json(pcs);
  }

  static async listAvailability(req: Request, res: Response) {
    const availability = await staffService.getOtherLabAvailability(
      req.query.date ? String(req.query.date) : undefined
    );
    res.status(StatusCodes.OK).json(availability);
  }

  static async listPublicSchedules(req: Request, res: Response) {
    const schedules = await staffService.getOtherLabPublicSchedules(
      req.query.date ? String(req.query.date) : undefined
    );
    res.status(StatusCodes.OK).json(schedules);
  }

  static async updateMyLabReservation(req: Request, res: Response) {
    const reservation = await staffService.updateMyLabReservation(
      req.authUser!.id,
      Number(req.params.id),
      req.body
    );

    res.status(StatusCodes.OK).json(reservation);
  }

  static async updateMyLabSchedule(req: Request, res: Response) {
    const schedule = await staffService.updateMyLabSchedule(
      req.authUser!.id,
      Number(req.params.id),
      req.body
    );

    res.status(StatusCodes.OK).json(schedule);
  }

  static async updateMyLabPcStatus(req: Request, res: Response) {
    const pc = await staffService.updateMyLabPcStatus(
      req.authUser!.id,
      Number(req.params.id),
      req.body.status
    );

    res.status(StatusCodes.OK).json(pc);
  }
}
