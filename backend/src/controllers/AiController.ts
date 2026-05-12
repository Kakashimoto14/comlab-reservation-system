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
}
