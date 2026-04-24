import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { ReservationService } from "../services/ReservationService.js";

const reservationService = new ReservationService(prisma);

export class ReservationController {
  static async list(req: Request, res: Response) {
    const reservations = await reservationService.listReservations(req.authUser!);
    res.status(StatusCodes.OK).json(reservations);
  }

  static async create(req: Request, res: Response) {
    const reservation = await reservationService.createReservation(
      req.body,
      req.authUser!.id
    );

    res.status(StatusCodes.CREATED).json(reservation);
  }

  static async cancel(req: Request, res: Response) {
    const reservation = await reservationService.cancelReservation(
      Number(req.params.id),
      req.authUser!.id
    );

    res.status(StatusCodes.OK).json(reservation);
  }

  static async review(req: Request, res: Response) {
    const reservation = await reservationService.reviewReservation(
      Number(req.params.id),
      req.body,
      req.authUser!
    );

    res.status(StatusCodes.OK).json(reservation);
  }

  static async complete(req: Request, res: Response) {
    const reservation = await reservationService.completeReservation(
      Number(req.params.id),
      req.authUser!,
      req.body.remarks
    );

    res.status(StatusCodes.OK).json(reservation);
  }
}
