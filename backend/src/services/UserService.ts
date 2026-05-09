import type { Prisma, PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";

import { UserFactory } from "../domain/UserFactory.js";
import { ApiError } from "../utils/ApiError.js";
import { assertRoleScopedUserFields } from "../validations/userRules.js";
import { ActivityLogService } from "./ActivityLogService.js";

type CreateUserInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: UserRole;
  studentNumber?: string | null;
  department?: string | null;
  yearLevel?: number | null;
  phone?: string | null;
};

type UpdateUserInput = Partial<CreateUserInput> & {
  status?: UserStatus;
};

type UpdateProfileInput = {
  firstName: string;
  lastName: string;
  department?: string | null;
  yearLevel?: number | null;
  phone?: string | null;
};

type DbClient = PrismaClient | Prisma.TransactionClient;

const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  status: true,
  studentNumber: true,
  department: true,
  yearLevel: true,
  phone: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

const userEntitySelect = {
  ...publicUserSelect,
  passwordHash: true
} satisfies Prisma.UserSelect;

export class UserService {
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
  }

  private getPersistedStudentFields(
    role: UserRole,
    input: {
      studentNumber?: string | null;
      yearLevel?: number | null;
    }
  ) {
    assertRoleScopedUserFields({
      role,
      studentNumber: input.studentNumber ?? null,
      yearLevel: input.yearLevel ?? null
    });

    if (role !== "STUDENT") {
      return {
        studentNumber: null,
        yearLevel: null
      };
    }

    return {
      studentNumber: input.studentNumber!,
      yearLevel: input.yearLevel!
    };
  }

  async listUsers() {
    return this.db.user.findMany({
      select: publicUserSelect,
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { firstName: "asc" }]
    });
  }

  async createUser(input: CreateUserInput, actorId: number) {
    const studentFields = this.getPersistedStudentFields(input.role, {
      studentNumber: input.studentNumber ?? null,
      yearLevel: input.yearLevel ?? null
    });
    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [
          { email: input.email },
          ...(studentFields.studentNumber
            ? [{ studentNumber: studentFields.studentNumber }]
            : [])
        ]
      }
    });

    if (existingUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "A user with the same email or student number already exists.",
        {
          ...(existingUser.email === input.email
            ? { email: ["An account with that email already exists."] }
            : {}),
          ...(existingUser.studentNumber &&
          studentFields.studentNumber &&
          existingUser.studentNumber === studentFields.studentNumber
            ? { studentNumber: ["That student number is already registered."] }
            : {})
        }
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await this.db.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        role: input.role,
        department: input.department ?? null,
        phone: input.phone ?? null,
        ...studentFields,
        passwordHash
      },
      select: publicUserSelect
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      action: "CREATE_USER",
      entityType: "USER",
      entityId: user.id,
      description: `Created ${user.role.toLowerCase()} account for ${user.firstName} ${user.lastName}.`
    });

    return user;
  }

  async updateUser(userId: number, input: UpdateUserInput, actorId: number) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: userEntitySelect
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const nextRole = input.role ?? user.role;
    const studentFields = this.getPersistedStudentFields(nextRole, {
      studentNumber:
        typeof input.studentNumber !== "undefined" ? input.studentNumber : user.studentNumber,
      yearLevel: typeof input.yearLevel !== "undefined" ? input.yearLevel : user.yearLevel
    });

    const duplicateUser = await this.db.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          ...(input.email ? [{ email: input.email }] : []),
          ...(studentFields.studentNumber
            ? [{ studentNumber: studentFields.studentNumber }]
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
          ...(studentFields.studentNumber &&
          duplicateUser.studentNumber === studentFields.studentNumber
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
          ...(typeof input.firstName !== "undefined" ? { firstName: input.firstName } : {}),
          ...(typeof input.lastName !== "undefined" ? { lastName: input.lastName } : {}),
          ...(typeof input.email !== "undefined" ? { email: input.email } : {}),
          ...(typeof input.role !== "undefined" ? { role: input.role } : {}),
          ...(typeof input.department !== "undefined"
            ? { department: input.department ?? null }
            : {}),
          ...(typeof input.phone !== "undefined" ? { phone: input.phone ?? null } : {}),
          ...(typeof input.status !== "undefined" ? { status: input.status } : {}),
          studentNumber: studentFields.studentNumber,
          yearLevel: studentFields.yearLevel,
          ...(passwordHash ? { passwordHash } : {})
        },
        select: publicUserSelect
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

    return updatedUser;
  }

  async setUserStatus(userId: number, status: UserStatus, actorId: number) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: publicUserSelect
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const updatedUser = await this.db.$transaction(async (tx) => {
      const nextUser = await tx.user.update({
        where: { id: userId },
        data: { status },
        select: publicUserSelect
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

    return updatedUser;
  }

  async updateProfile(userId: number, input: UpdateProfileInput) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: userEntitySelect
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    const userEntity = UserFactory.create(user);

    if (!userEntity.isActive()) {
      throw new ApiError(StatusCodes.FORBIDDEN, "Inactive users cannot update profiles.");
    }

    const studentFields =
      user.role === "STUDENT"
        ? this.getPersistedStudentFields(user.role, {
            studentNumber: user.studentNumber,
            yearLevel:
              typeof input.yearLevel !== "undefined" ? input.yearLevel : user.yearLevel
          })
        : {
            studentNumber: null,
            yearLevel: null
          };

    if (user.role !== "STUDENT" && input.yearLevel !== undefined && input.yearLevel !== null) {
      assertRoleScopedUserFields({
        role: user.role,
        studentNumber: user.studentNumber ?? null,
        yearLevel: input.yearLevel
      });
    }

    const updatedUser = await this.db.user.update({
      where: { id: userId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        department: input.department ?? null,
        phone: input.phone ?? null,
        yearLevel: studentFields.yearLevel
      },
      select: publicUserSelect
    });

    await this.activityLogService.logActivity({
      userId,
      action: "UPDATE_PROFILE",
      entityType: "USER",
      entityId: updatedUser.id,
      description: `${updatedUser.firstName} ${updatedUser.lastName} updated their profile.`
    });

    return updatedUser;
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
