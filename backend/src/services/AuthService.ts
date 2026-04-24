import type { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import { env } from "../config/env.js";
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

type ForgotPasswordInput = {
  email: string;
};

type ResetPasswordInput = {
  token: string;
  password: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type PasswordActionResponse = {
  message: string;
  previewResetUrl?: string;
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

  async forgotPassword(input: ForgotPasswordInput): Promise<PasswordActionResponse> {
    const user = await this.db.user.findUnique({
      where: { email: input.email }
    });

    const genericResponse: PasswordActionResponse = {
      message:
        "If an account with that email exists, a password reset link has been prepared."
    };

    if (!user) {
      return genericResponse;
    }

    const userEntity = UserFactory.create(user);

    if (!userEntity.isActive()) {
      return genericResponse;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + env.RESET_TOKEN_TTL_MINUTES * 60 * 1000);

    await this.db.passwordResetToken.deleteMany({
      where: {
        OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }]
      }
    });

    await this.db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt
      }
    });

    const previewResetUrl = this.buildResetUrl(rawToken);

    console.info(`Password reset link generated for ${user.email}: ${previewResetUrl}`);

    await this.activityLogService.logActivity({
      userId: user.id,
      action: "REQUEST_PASSWORD_RESET",
      entityType: "USER",
      entityId: user.id,
      description: `${user.firstName} ${user.lastName} requested a password reset link.`
    });

    return {
      ...genericResponse,
      ...(env.RESET_TOKEN_PREVIEW ? { previewResetUrl } : {})
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<PasswordActionResponse> {
    const tokenHash = this.hashResetToken(input.token);

    const passwordResetToken = await this.db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (
      !passwordResetToken ||
      passwordResetToken.usedAt ||
      passwordResetToken.expiresAt < new Date()
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "This password reset link is invalid or has already expired."
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: passwordResetToken.userId },
        data: { passwordHash }
      }),
      this.db.passwordResetToken.update({
        where: { id: passwordResetToken.id },
        data: { usedAt: new Date() }
      }),
      this.db.passwordResetToken.deleteMany({
        where: {
          userId: passwordResetToken.userId,
          id: { not: passwordResetToken.id }
        }
      })
    ]);

    await this.activityLogService.logActivity({
      userId: passwordResetToken.userId,
      action: "RESET_PASSWORD",
      entityType: "USER",
      entityId: passwordResetToken.userId,
      description: `${passwordResetToken.user.firstName} ${passwordResetToken.user.lastName} reset their password.`
    });

    return {
      message: "Password has been reset successfully. You can now log in with your new password."
    };
  }

  async changePassword(
    userId: number,
    input: ChangePasswordInput
  ): Promise<PasswordActionResponse> {
    const user = await this.db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      input.currentPassword,
      user.passwordHash
    );

    if (!isCurrentPasswordValid) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Current password is incorrect.");
    }

    const passwordHash = await bcrypt.hash(input.newPassword, 10);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: { passwordHash }
      }),
      this.db.passwordResetToken.deleteMany({
        where: { userId }
      })
    ]);

    await this.activityLogService.logActivity({
      userId,
      action: "CHANGE_PASSWORD",
      entityType: "USER",
      entityId: userId,
      description: `${user.firstName} ${user.lastName} changed their password.`
    });

    return {
      message: "Password updated successfully."
    };
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

  async logout(userId: number) {
    const user = await this.db.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    await this.activityLogService.logActivity({
      userId,
      action: "LOGOUT",
      entityType: "USER",
      entityId: userId,
      description: `${user.firstName} ${user.lastName} signed out.`
    });

    return {
      message: "Logged out successfully."
    };
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

  private hashResetToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private buildResetUrl(token: string) {
    return `${env.APP_BASE_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
  }
}
