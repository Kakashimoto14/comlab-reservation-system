import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { ReservationAssistantService } from "../services/ReservationAssistantService.js";

const reservationAssistantService = new ReservationAssistantService(prisma);

export class AiController {
  static async askReservationAssistant(req: Request, res: Response) {
    const result = await reservationAssistantService.askReservationAssistant(
      req.authUser!,
      req.body.message
    );

    res.status(StatusCodes.OK).json(result);
  }

  static async confirmPendingAssistantAction(req: Request, res: Response) {
    const result = await reservationAssistantService.confirmPendingAction(
      req.authUser!,
      String(req.params.actionId),
      typeof req.body.confirmation === "string" ? req.body.confirmation : undefined
    );

    res.status(StatusCodes.OK).json(result);
  }

  static async cancelPendingAssistantAction(req: Request, res: Response) {
    const result = await reservationAssistantService.cancelPendingAction(
      req.authUser!,
      String(req.params.actionId)
    );

    res.status(StatusCodes.OK).json(result);
  }
}
