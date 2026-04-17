import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { DashboardService } from "../services/DashboardService.js";

const dashboardService = new DashboardService(prisma);

export class DashboardController {
  static async getData(req: Request, res: Response) {
    const data = await dashboardService.getDashboardData(req.authUser!);

    res.status(StatusCodes.OK).json(data);
  }
}
