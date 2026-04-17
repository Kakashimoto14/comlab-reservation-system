import type { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";

import { UserFactory } from "../domain/UserFactory.js";
import { ApiError } from "../utils/ApiError.js";
import { ActivityLogService } from "./ActivityLogService.js";

type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  studentNumber?: string;
  department?: string;
  yearLevel?: number;
  phone?: string;
};

type UpdateUserInput = Partial<CreateUserInput> & {
  status?: UserStatus;
};

type UpdateProfileInput = {
  firstName: string;
  lastName: string;
  department?: string;
  yearLevel?: number;
  phone?: string;
};

export class UserService {
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
  }

  async listUsers() {
    const users = await this.db.user.findMany({
      orderBy: [{ role: "asc" }, { lastName: "asc" }]
    });

    return users.map(({ passwordHash: _passwordHash, ...user }) => user);
  }

  async createUser(input: CreateUserInput, actorId: number) {
    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          ...(input.studentNumber ? [{ studentNumber: input.studentNumber }] : [])
        ]
      }
    });

    if (existingUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "A user with the same email or student number already exists."
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const { password: _password, ...userData } = input;

    const user = await this.db.user.create({
      data: {
        ...userData,
        passwordHash
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: "CREATE_USER",
      entityType: "USER",
      entityId: user.id,
      description: `Created ${user.role.toLowerCase()} account for ${user.firstName} ${user.lastName}.`
    });

    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async updateUser(userId: number, input: UpdateUserInput, actorId: number) {
    const user = await this.db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const duplicateUser = await this.db.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          ...(input.studentNumber ? [{ studentNumber: input.studentNumber }] : [])
        ]
      }
    });

    if (duplicateUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Another user already uses that email or student number."
      );
    }

    const updatedUser = await this.db.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        studentNumber: input.studentNumber,
        department: input.department,
        yearLevel: input.yearLevel,
        phone: input.phone,
        status: input.status,
        ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {})
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: "UPDATE_USER",
      entityType: "USER",
      entityId: updatedUser.id,
      description: `Updated user account for ${updatedUser.firstName} ${updatedUser.lastName}.`
    });

    const { passwordHash: _passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }

  async setUserStatus(userId: number, status: UserStatus, actorId: number) {
    const user = await this.db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const updatedUser = await this.db.user.update({
      where: { id: userId },
      data: { status }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: status === "ACTIVE" ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "USER",
      entityId: updatedUser.id,
      description: `${status === "ACTIVE" ? "Activated" : "Deactivated"} ${updatedUser.firstName} ${updatedUser.lastName}.`
    });

    const { passwordHash: _passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }

  async updateProfile(userId: number, input: UpdateProfileInput) {
    const user = await this.db.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const userEntity = UserFactory.create(user);

    if (!userEntity.isActive()) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Inactive users cannot update profiles.");
    }

    const updatedUser = await this.db.user.update({
      where: { id: userId },
      data: input
    });

    await this.activityLogService.logActivity({
      userId,
      action: "UPDATE_PROFILE",
      entityType: "USER",
      entityId: updatedUser.id,
      description: `${updatedUser.firstName} ${updatedUser.lastName} updated their profile.`
    });

    const { passwordHash: _passwordHash, ...safeUser } = updatedUser;
    return safeUser;
  }
}
