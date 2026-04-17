import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { LaboratoryService } from "../services/LaboratoryService.js";

const laboratoryService = new LaboratoryService(prisma);

export class LaboratoryController {
  static async list(req: Request, res: Response) {
    const includeUnavailable = req.authUser
      ? req.authUser.role !== "STUDENT"
      : false;
    const laboratories = await laboratoryService.listLaboratories(includeUnavailable);
    res.status(StatusCodes.OK).json(laboratories);
  }

  static async getById(req: Request, res: Response) {
    const laboratory = await laboratoryService.getLaboratoryById(Number(req.params.id));
    res.status(StatusCodes.OK).json(laboratory);
  }

  static async create(req: Request, res: Response) {
    const laboratory = await laboratoryService.createLaboratory(req.body, req.authUser!.id);
    res.status(StatusCodes.CREATED).json(laboratory);
  }

  static async update(req: Request, res: Response) {
    const laboratory = await laboratoryService.updateLaboratory(
      Number(req.params.id),
      req.body,
      req.authUser!.id
    );

    res.status(StatusCodes.OK).json(laboratory);
  }

  static async remove(req: Request, res: Response) {
    await laboratoryService.deleteLaboratory(Number(req.params.id), req.authUser!.id);

    res.status(StatusCodes.OK).json({
      message: "Laboratory deleted successfully."
    });
  }
}
