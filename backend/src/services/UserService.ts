import type { Prisma, PrismaClient, UserRole, UserStatus } from "@prisma/client";
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

type DbClient = PrismaClient | Prisma.TransactionClient;

export class UserService {
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
  }

  private normalizeCreateInput(input: CreateUserInput) {
    if (input.role === "STUDENT") {
      return input;
    }

    return {
      ...input,
      studentNumber: undefined,
      yearLevel: undefined
    };
  }

  private getRoleAwareUpdateData(input: UpdateUserInput) {
    if (input.role && input.role !== "STUDENT") {
      return {
        studentNumber: null,
        yearLevel: null
      };
    }

    return {
      studentNumber: input.studentNumber,
      yearLevel: input.yearLevel
    };
  }

  async listUsers() {
    const users = await this.db.user.findMany({
      orderBy: [{ role: "asc" }, { lastName: "asc" }]
    });

    return users.map(({ passwordHash: _passwordHash, ...user }) => user);
  }

  async createUser(input: CreateUserInput, actorId: number) {
    const normalizedInput = this.normalizeCreateInput(input);
    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [
          { email: normalizedInput.email },
          ...(normalizedInput.studentNumber
            ? [{ studentNumber: normalizedInput.studentNumber }]
            : [])
        ]
      }
    });

    if (existingUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "A user with the same email or student number already exists.",
        {
          ...(existingUser.email === normalizedInput.email
            ? { email: ["An account with that email already exists."] }
            : {}),
          ...(existingUser.studentNumber &&
          normalizedInput.studentNumber &&
          existingUser.studentNumber === normalizedInput.studentNumber
            ? { studentNumber: ["That student number is already registered."] }
            : {})
        }
      );
    }

    const passwordHash = await bcrypt.hash(normalizedInput.password, 10);
    const { password: _password, ...userData } = normalizedInput;

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
    const roleAwareUpdateData = this.getRoleAwareUpdateData(input);

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const duplicateUser = await this.db.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          ...(roleAwareUpdateData.studentNumber
            ? [{ studentNumber: roleAwareUpdateData.studentNumber }]
            : [])
        ]
      }
    });

    if (duplicateUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "Another user already uses that email or student number.",
        {
          ...(input.email && duplicateUser.email === input.email
            ? { email: ["Another user already uses that email."] }
            : {}),
          ...(roleAwareUpdateData.studentNumber &&
          duplicateUser.studentNumber === roleAwareUpdateData.studentNumber
            ? { studentNumber: ["Another user already uses that student number."] }
            : {})
        }
      );
    }

    const shouldRevokeSessions =
      (typeof input.role !== "undefined" && input.role !== user.role) ||
      (typeof input.status !== "undefined" && input.status !== user.status);

    const passwordHash = input.password ? await bcrypt.hash(input.password, 10) : undefined;

    const updatedUser = await this.db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          role: input.role,
          ...roleAwareUpdateData,
          department: input.department,
          phone: input.phone,
          status: input.status,
          ...(passwordHash ? { passwordHash } : {})
        }
      });

      if (shouldRevokeSessions) {
        await this.revokeActiveSessions(tx, userId);
      }

      return nextUser;
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

    const updatedUser = await this.db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: { status }
      });

      await this.revokeActiveSessions(tx, userId);

      return nextUser;
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

  private async revokeActiveSessions(dbClient: DbClient, userId: number) {
    await dbClient.authSession.updateMany({
      where: {
        userId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }
}
