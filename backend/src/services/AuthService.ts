import type { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";

import { UserFactory } from "../domain/UserFactory.js";
import { ApiError } from "../utils/ApiError.js";
import { signToken } from "../utils/jwt.js";
import { ActivityLogService } from "./ActivityLogService.js";

type RegisterStudentInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  studentNumber: string;
  department: string;
  yearLevel: number;
  phone?: string;
};

type LoginInput = {
  email: string;
  password: string;
};

export class AuthService {
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
  }

  async registerStudent(input: RegisterStudentInput) {
    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [{ email: input.email }, { studentNumber: input.studentNumber }]
      }
    });

    if (existingUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "An account with that email or student number already exists."
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const { password: _password, ...userData } = input;

    const user = await this.db.user.create({
      data: {
        ...userData,
        phone: input.phone ?? null,
        role: "STUDENT",
        passwordHash
      }
    });

    await this.activityLogService.logActivity({
      userId: user.id,
      action: "REGISTER",
      entityType: "USER",
      entityId: user.id,
      description: `${user.firstName} ${user.lastName} created a student account.`
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async login(input: LoginInput) {
    const user = await this.db.user.findUnique({
      where: { email: input.email }
    });

    if (!user) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid email or password.");
    }

    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);

    if (!isPasswordValid) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Invalid email or password.");
    }

    const userEntity = UserFactory.create(user);

    if (!userEntity.isActive()) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "This account has been deactivated by the administrator."
      );
    }

    await this.activityLogService.logActivity({
      userId: user.id,
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      description: `${user.firstName} ${user.lastName} signed in.`
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async getProfile(userId: number) {
    const user = await this.db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    return this.toSafeUser(user);
  }

  private async buildAuthResponse(id: number, email: string, role: UserRole) {
    const user = await this.getProfile(id);

    return {
      token: signToken({ id, email, role }),
      user
    };
  }

  private toSafeUser(user: Awaited<ReturnType<PrismaClient["user"]["findUnique"]>>) {
    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
