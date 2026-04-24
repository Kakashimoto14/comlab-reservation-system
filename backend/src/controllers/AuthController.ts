import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { AuthService } from "../services/AuthService.js";

const authService = new AuthService(prisma);

export class AuthController {
  static async register(req: Request, res: Response) {
    const result = await authService.registerStudent(req.body);

    res.status(StatusCodes.CREATED).json(result);
  }

  static async login(req: Request, res: Response) {
    const result = await authService.login(req.body);

    res.status(StatusCodes.OK).json(result);
  }

  static async forgotPassword(req: Request, res: Response) {
    const result = await authService.forgotPassword(req.body);

    res.status(StatusCodes.OK).json(result);
  }

  static async resetPassword(req: Request, res: Response) {
    const result = await authService.resetPassword(req.body);

    res.status(StatusCodes.OK).json(result);
  }

  static async changePassword(req: Request, res: Response) {
    const result = await authService.changePassword(req.authUser!.id, req.body);

    res.status(StatusCodes.OK).json(result);
  }

  static async me(req: Request, res: Response) {
    const profile = await authService.getProfile(req.authUser!.id);

    res.status(StatusCodes.OK).json(profile);
  }

  static async logout(_req: Request, res: Response) {
    const result = await authService.logout(_req.authUser!.id);

    res.status(StatusCodes.OK).json(result);
  }
}
