import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { AuthService } from "../services/AuthService.js";
import {
  clearAuthCookies,
  setAccessAuthCookie,
  setRefreshAuthCookie
} from "../utils/authCookie.js";

const authService = new AuthService(prisma);

const buildSessionMeta = (req: Request) => ({
  ipAddress: req.ip ?? null,
  userAgent: req.get("user-agent") ?? null
});

export class AuthController {
  static async register(req: Request, res: Response) {
    const result = await authService.registerStudent(req.body);

    clearAuthCookies(res);
    res.status(StatusCodes.CREATED).json(result);
  }

  static async login(req: Request, res: Response) {
    const { accessToken, refreshToken, user } = await authService.login(
      req.body,
      buildSessionMeta(req)
    );

    setAccessAuthCookie(res, accessToken);
    setRefreshAuthCookie(res, refreshToken);
    res.status(StatusCodes.OK).json({ user });
  }

  static async refresh(req: Request, res: Response) {
    const refreshToken = req.cookies?.[env.REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      clearAuthCookies(res);
      res.status(StatusCodes.UNAUTHORIZED).json({
        message: "Session expired. Please log in again."
      });
      return;
    }

    const { accessToken, refreshToken: rotatedRefreshToken, user } =
      await authService.refreshSession(refreshToken, buildSessionMeta(req));

    setAccessAuthCookie(res, accessToken);
    setRefreshAuthCookie(res, rotatedRefreshToken);
    res.status(StatusCodes.OK).json({ user });
  }

  static async verifyEmail(req: Request, res: Response) {
    const result = await authService.verifyEmail(req.body);

    res.status(StatusCodes.OK).json(result);
  }

  static async resendVerification(req: Request, res: Response) {
    const result = await authService.resendVerification(req.body);

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
    const result = await authService.changePassword(
      req.authUser!.id,
      req.authUser!.sessionId,
      req.body
    );

    res.status(StatusCodes.OK).json(result);
  }

  static async me(req: Request, res: Response) {
    const profile = await authService.getProfile(req.authUser!.id);

    res.status(StatusCodes.OK).json(profile);
  }

  static async logout(_req: Request, res: Response) {
    const refreshToken = _req.cookies?.[env.REFRESH_COOKIE_NAME] ?? null;

    if (_req.authUser) {
      await authService.logoutSession(
        _req.authUser.id,
        refreshToken
      );
    } else if (refreshToken) {
      await authService.logoutByRefreshToken(refreshToken);
    }

    clearAuthCookies(res);
    res.status(StatusCodes.OK).json({
      message: "Logged out successfully."
    });
  }
}
