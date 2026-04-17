import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";

import { prisma } from "../config/prisma.js";
import { UserService } from "../services/UserService.js";

const userService = new UserService(prisma);

export class UserController {
  static async list(req: Request, res: Response) {
    const users = await userService.listUsers();
    res.status(StatusCodes.OK).json(users);
  }

  static async create(req: Request, res: Response) {
    const user = await userService.createUser(req.body, req.authUser!.id);
    res.status(StatusCodes.CREATED).json(user);
  }

  static async update(req: Request, res: Response) {
    const user = await userService.updateUser(
      Number(req.params.id),
      req.body,
      req.authUser!.id
    );

    res.status(StatusCodes.OK).json(user);
  }

  static async updateStatus(req: Request, res: Response) {
    const user = await userService.setUserStatus(
      Number(req.params.id),
      req.body.status,
      req.authUser!.id
    );

    res.status(StatusCodes.OK).json(user);
  }

  static async updateProfile(req: Request, res: Response) {
    const profile = await userService.updateProfile(req.authUser!.id, req.body);

    res.status(StatusCodes.OK).json(profile);
  }
}
