import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { AuthService } from "../services/AuthService.js";
import { clearAuthCookie, setAuthCookie } from "../utils/authCookie.js";

const authService = new AuthService(prisma);

export class AuthController {
  static async register(req: Request, res: Response) {
    const { token, user } = await authService.registerStudent(req.body);

    setAuthCookie(res, token);
    res.status(StatusCodes.CREATED).json({ user });
  }

  static async login(req: Request, res: Response) {
    const { token, user } = await authService.login(req.body);

    setAuthCookie(res, token);
    res.status(StatusCodes.OK).json({ user });
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
    if (_req.authUser) {
      await authService.logout(_req.authUser.id);
    }

    clearAuthCookie(res);
    res.status(StatusCodes.OK).json({
      message: "Logged out successfully."
    });
  }
}
