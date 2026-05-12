import type { Prisma, PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { StatusCodes } from "http-status-codes";

import { env } from "../config/env.js";
import { UserFactory } from "../domain/UserFactory.js";
import { ApiError } from "../utils/ApiError.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from "../utils/jwt.js";
import { assertRoleScopedUserFields } from "../validations/userRules.js";
import { ActivityLogService } from "./ActivityLogService.js";
import { EmailService } from "./EmailService.js";

type RegisterStudentInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  studentNumber: string;
  department: string;
  yearLevel: number;
  phone: string;
};

type LoginInput = {
  email: string;
  password: string;
};

type VerifyEmailInput = {
  token: string;
};

type ResendVerificationInput = {
  email: string;
};

type ForgotPasswordInput = {
  email: string;
};

type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

type ChangePasswordInput = {
  currentPassword: string;
  newPassword: string;
};

type AuthActionResponse = {
  message: string;
  previewResetUrl?: string;
  previewVerificationUrl?: string;
};

type AuthSessionMeta = {
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: Awaited<ReturnType<AuthService["getProfile"]>>;
};

const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  emailVerifiedAt: true,
  role: true,
  status: true,
  studentNumber: true,
  department: true,
  yearLevel: true,
  phone: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

const authUserSelect = {
  ...publicUserSelect,
  passwordHash: true
} satisfies Prisma.UserSelect;

export class AuthService {
  private readonly activityLogService: ActivityLogService;
  private readonly emailService: EmailService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
    this.emailService = new EmailService();
  }

  async registerStudent(input: RegisterStudentInput): Promise<AuthActionResponse> {
    await this.ensureEmailDeliveryAvailable();

    assertRoleScopedUserFields({
      role: "STUDENT",
      studentNumber: input.studentNumber,
      yearLevel: input.yearLevel
    });

    const existingUser = await this.db.user.findFirst({
      where: {
        OR: [{ email: input.email }, { studentNumber: input.studentNumber }]
      }
    });

    if (existingUser) {
      throw new ApiError(
        StatusCodes.CONFLICT,
        "An account with that email or student number already exists.",
        {
          ...(existingUser.email === input.email
            ? { email: ["An account with that email already exists."] }
            : {}),
          ...(existingUser.studentNumber === input.studentNumber
            ? { studentNumber: ["That student number is already registered."] }
            : {})
        }
      );
    }

    const passwordHash = await bcrypt.hash(input.password, 10);
    const { password: _password, ...userData } = input;

    const { user, rawToken } = await this.db.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          ...userData,
          phone: input.phone,
          role: "STUDENT",
          passwordHash,
          emailVerifiedAt: null
        }
      });

      const rawToken = crypto.randomBytes(32).toString("hex");

      await tx.emailVerificationToken.deleteMany({
        where: {
          OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }]
        }
      });

      await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: this.buildVerificationExpiry()
        }
      });

      return {
        user,
        rawToken
      };
    });

    const verificationUrl = this.buildVerificationUrl(rawToken);

    await this.activityLogService.logActivity({
      userId: user.id,
      action: "REGISTER",
      entityType: "USER",
      entityId: user.id,
      description: `${user.firstName} ${user.lastName} created a student account.`
    });

    await this.sendVerificationEmail(user, verificationUrl);

    return {
      message:
        "Account created. Please check your email to verify your account before logging in.",
      ...(this.shouldIncludePreviewLink()
        ? { previewVerificationUrl: verificationUrl }
        : {})
    };
  }

  async login(input: LoginInput, sessionMeta?: AuthSessionMeta) {
    const user = await this.db.user.findUnique({
      where: { email: input.email },
      select: authUserSelect
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

    if (!user.emailVerifiedAt) {
      throw new ApiError(
        StatusCodes.FORBIDDEN,
        "Please verify your email before logging in. Check your inbox."
      );
    }

    await this.activityLogService.logActivity({
      userId: user.id,
      action: "LOGIN",
      entityType: "USER",
      entityId: user.id,
      description: `${user.firstName} ${user.lastName} signed in.`
    });

    return this.buildAuthResponse(user.id, user.email, user.role, sessionMeta);
  }

  async verifyEmail(input: VerifyEmailInput): Promise<AuthActionResponse> {
    const tokenHash = this.hashToken(input.token);

    const verificationToken = await this.db.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: authUserSelect
        }
      }
    });

    if (
      !verificationToken ||
      verificationToken.usedAt ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        "This email verification link is invalid or has already expired."
      );
    }

    await this.db.$transaction([
      this.db.user.update({
        where: { id: verificationToken.userId },
        data: {
          emailVerifiedAt: new Date()
        }
      }),
      this.db.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: {
          usedAt: new Date()
        }
      }),
      this.db.emailVerificationToken.deleteMany({
        where: {
          userId: verificationToken.userId,
          id: { not: verificationToken.id }
        }
      })
    ]);

    await this.activityLogService.logActivity({
      userId: verificationToken.userId,
      action: "VERIFY_EMAIL",
      entityType: "USER",
      entityId: verificationToken.userId,
      description: `${verificationToken.user.firstName} ${verificationToken.user.lastName} verified their email address.`
    });

    return {
      message: "Email verified successfully. You can now log in."
    };
  }

  async resendVerification(input: ResendVerificationInput): Promise<AuthActionResponse> {
    await this.ensureEmailDeliveryAvailable();

    const genericResponse: AuthActionResponse = {
      message:
        "If an unverified account exists for that email, a verification email has been sent."
    };

    const user = await this.db.user.findUnique({
      where: { email: input.email },
      select: authUserSelect
    });

    if (!user) {
      return genericResponse;
    }

    const userEntity = UserFactory.create(user);

    if (!userEntity.isActive() || user.emailVerifiedAt) {
      return genericResponse;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const verificationUrl = this.buildVerificationUrl(rawToken);

    await this.db.$transaction([
      this.db.emailVerificationToken.deleteMany({
        where: {
          OR: [{ userId: user.id }, { expiresAt: { lt: new Date() } }]
        }
      }),
      this.db.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: this.buildVerificationExpiry()
        }
      })
    ]);

    await this.activityLogService.logActivity({
      userId: user.id,
      action: "RESEND_EMAIL_VERIFICATION",
      entityType: "USER",
      entityId: user.id,
      description: `${user.firstName} ${user.lastName} requested another verification email.`
    });

    await this.sendVerificationEmail(user, verificationUrl);

    return {
      ...genericResponse,
      ...(this.shouldIncludePreviewLink()
        ? { previewVerificationUrl: verificationUrl }
        : {})
    };
  }

  async forgotPassword(input: ForgotPasswordInput): Promise<AuthActionResponse> {
    await this.ensureEmailDeliveryAvailable();

    const user = await this.db.user.findUnique({
      where: { email: input.email },
      select: authUserSelect
    });

    const genericResponse: AuthActionResponse = {
      message: "If an account exists, a password reset link has been sent."
    };

    if (!user) {
      return genericResponse;
    }

    const userEntity = UserFactory.create(user);

    if (!userEntity.isActive()) {
      return genericResponse;
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = this.hashToken(rawToken);
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

    await this.activityLogService.logActivity({
      userId: user.id,
      action: "REQUEST_PASSWORD_RESET",
      entityType: "USER",
      entityId: user.id,
      description: `${user.firstName} ${user.lastName} requested a password reset link.`
    });

    await this.sendPasswordResetEmail(user, previewResetUrl);

    return {
      ...genericResponse,
      ...(this.shouldIncludePreviewLink() ? { previewResetUrl } : {})
    };
  }

  async resetPassword(input: ResetPasswordInput): Promise<AuthActionResponse> {
    const tokenHash = this.hashToken(input.token);

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

    const passwordHash = await bcrypt.hash(input.newPassword, 10);

    await this.db.$transaction([
      this.db.user.update({
        where: { id: passwordResetToken.userId },
        data: { passwordHash }
      }),
      this.db.authSession.updateMany({
        where: {
          userId: passwordResetToken.userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
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
    _sessionId: number,
    input: ChangePasswordInput
  ): Promise<AuthActionResponse> {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: authUserSelect
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
      this.db.authSession.updateMany({
        where: {
          userId,
          revokedAt: null
        },
        data: {
          revokedAt: new Date()
        }
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
      where: { id: userId },
      select: publicUserSelect
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    return user;
  }

  async logout(userId: number) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
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

  async refreshSession(refreshToken: string, sessionMeta?: AuthSessionMeta): Promise<AuthResponse> {
    let payload: { id: number; sid: number };

    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (_error) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Session expired. Please log in again.");
    }

    const session = await this.db.authSession.findUnique({
      where: { id: payload.sid },
      include: {
        user: {
          select: publicUserSelect
        }
      }
    });

    if (!session) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Session not found. Please log in again.");
    }

    const isValidToken = session.tokenHash === this.hashRefreshToken(refreshToken);
    const isExpired = session.expiresAt <= new Date();
    const isRevoked = Boolean(session.revokedAt);
    const isActive = session.user.status === "ACTIVE";
    const isVerified = Boolean(session.user.emailVerifiedAt);

    if (
      !isValidToken ||
      isExpired ||
      isRevoked ||
      !isActive ||
      !isVerified ||
      session.userId !== payload.id
    ) {
      await this.safeRevokeSession(session.id);
      throw new ApiError(StatusCodes.UNAUTHORIZED, "Session expired. Please log in again.");
    }

    const rotatedTokens = await this.rotateSession(session.id, session.userId, {
      email: session.user.email,
      role: session.user.role,
      sessionMeta
    });

    await this.activityLogService.logActivity({
      userId: session.userId,
      action: "REFRESH_SESSION",
      entityType: "AUTH_SESSION",
      entityId: session.id,
      description: `${session.user.firstName} ${session.user.lastName} refreshed their session.`
    });

    return {
      ...rotatedTokens,
      user: session.user
    };
  }

  async logoutSession(userId: number, refreshToken?: string | null) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true
      }
    });

    if (!user) {
      throw new ApiError(StatusCodes.NOT_FOUND, "User account not found.");
    }

    if (refreshToken) {
      await this.revokeSessionByTokenHash(this.hashRefreshToken(refreshToken));
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

  async logoutByRefreshToken(refreshToken: string) {
    await this.revokeSessionByTokenHash(this.hashRefreshToken(refreshToken));

    return {
      message: "Logged out successfully."
    };
  }

  private async buildAuthResponse(
    id: number,
    email: string,
    role: UserRole,
    sessionMeta?: AuthSessionMeta
  ): Promise<AuthResponse> {
    const user = await this.getProfile(id);
    const tokens = await this.createSessionTokens(id, { email, role, sessionMeta });

    return {
      ...tokens,
      user
    };
  }

  private async createSessionTokens(
    userId: number,
    input: { email: string; role: UserRole; sessionMeta?: AuthSessionMeta }
  ) {
    await this.db.authSession.deleteMany({
      where: {
        userId,
        OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null } }]
      }
    });

    const provisionalToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + env.REFRESH_COOKIE_MAX_AGE_MS);

    const session = await this.db.authSession.create({
      data: {
        userId,
        tokenHash: this.hashRefreshToken(provisionalToken),
        ipAddress: input.sessionMeta?.ipAddress ?? null,
        userAgent: input.sessionMeta?.userAgent ?? null,
        expiresAt,
        lastUsedAt: new Date()
      }
    });

    const refreshToken = signRefreshToken({
      id: userId,
      sid: session.id
    });

    await this.db.authSession.update({
      where: { id: session.id },
      data: {
        tokenHash: this.hashRefreshToken(refreshToken)
      }
    });

    return {
      accessToken: signAccessToken({
        id: userId,
        sid: session.id,
        email: input.email,
        role: input.role
      }),
      refreshToken
    };
  }

  private async rotateSession(
    sessionId: number,
    userId: number,
    input: {
      email: string;
      role: UserRole;
      sessionMeta?: AuthSessionMeta;
    }
  ) {
    await this.db.authSession.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date()
      }
    });

    return this.createSessionTokens(userId, input);
  }

  private async revokeSessionByTokenHash(tokenHash: string) {
    await this.db.authSession.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private async safeRevokeSession(sessionId: number) {
    await this.db.authSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  private hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private hashRefreshToken(token: string) {
    return this.hashToken(token);
  }

  private buildResetUrl(token: string) {
    return `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${token}`;
  }

  private buildVerificationUrl(token: string) {
    return `${env.FRONTEND_URL.replace(/\/$/, "")}/verify-email?token=${token}`;
  }

  private buildVerificationExpiry() {
    return new Date(Date.now() + env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS * 60 * 60 * 1000);
  }

  private shouldIncludePreviewLink() {
    return env.RESET_TOKEN_PREVIEW && env.NODE_ENV !== "production";
  }

  private async sendPasswordResetEmail(
    user: Prisma.UserGetPayload<{ select: typeof authUserSelect }>,
    previewResetUrl: string
  ) {
    const subject = "Reset your ComLab password";
    const text = [
      `Hello ${user.firstName},`,
      "",
      "We received a request to reset your ComLab Reservation System password.",
      `Use this link to continue: ${previewResetUrl}`,
      `This link expires in ${this.formatResetDurationLabel()}.`,
      "",
      "If you did not request this reset, you can safely ignore this email."
    ].join("\n");
    const html = this.buildEmailTemplate({
      title: "Reset your ComLab password",
      greeting: `Hello ${this.escapeHtml(user.firstName)},`,
      intro:
        "We received a request to reset your ComLab Reservation System password.",
      actionLabel: "Reset Password",
      actionUrl: previewResetUrl,
      expiryNotice: `This link expires in ${this.formatResetDurationLabel()}.`,
      outro: "If you did not request this reset, you can safely ignore this email."
    });

    await this.safeSendEmail({
      to: user.email,
      subject,
      text,
      html,
      previewUrl: previewResetUrl
    });
  }

  private async sendVerificationEmail(
    user: {
      firstName: string;
      email: string;
    },
    verificationUrl: string
  ) {
    const subject = "Verify your ComLab account";
    const text = [
      `Hello ${user.firstName},`,
      "",
      "Welcome to the ComLab Reservation System.",
      `Verify your email address with this link: ${verificationUrl}`,
      `This link expires in ${this.formatVerificationDurationLabel()}.`,
      "",
      "If you did not create this account, you can safely ignore this email."
    ].join("\n");
    const html = this.buildEmailTemplate({
      title: "Verify your ComLab account",
      greeting: `Hello ${this.escapeHtml(user.firstName)},`,
      intro: "Welcome to the ComLab Reservation System.",
      actionLabel: "Verify Email",
      actionUrl: verificationUrl,
      expiryNotice: `This link expires in ${this.formatVerificationDurationLabel()}.`,
      outro: "If you did not create this account, you can safely ignore this email."
    });

    await this.safeSendEmail({
      to: user.email,
      subject,
      text,
      html,
      previewUrl: verificationUrl
    });
  }

  private async safeSendEmail(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
    previewUrl: string;
  }) {
    try {
      await this.emailService.sendMail(input);
    } catch (error) {
      console.error("[auth] Failed to send auth email.", error);

      if (env.NODE_ENV === "production") {
        throw new ApiError(
          StatusCodes.SERVICE_UNAVAILABLE,
          "Transactional email delivery is temporarily unavailable. Please try again later."
        );
      }
    }
  }

  private async ensureEmailDeliveryAvailable() {
    try {
      await this.emailService.assertDeliveryReady();
    } catch (error) {
      console.error("[auth] Email delivery is not ready.", error);

      throw new ApiError(
        StatusCodes.SERVICE_UNAVAILABLE,
        "Transactional email delivery is not configured yet. Please try again later."
      );
    }
  }

  private buildEmailTemplate(input: {
    title: string;
    greeting: string;
    intro: string;
    actionLabel: string;
    actionUrl: string;
    expiryNotice: string;
    outro: string;
  }) {
    const actionUrl = this.escapeHtml(input.actionUrl);

    return `
      <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:32px;">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.18em;text-transform:uppercase;color:#475569;">ComLab Reservation System</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#0f172a;">${this.escapeHtml(input.title)}</h1>
          <p style="margin:0 0 12px;font-size:15px;line-height:1.7;color:#334155;">${input.greeting}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#334155;">${this.escapeHtml(input.intro)}</p>
          <a href="${actionUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:14px;font-weight:700;">${this.escapeHtml(input.actionLabel)}</a>
          <p style="margin:24px 0 8px;font-size:14px;line-height:1.7;color:#475569;">${this.escapeHtml(input.expiryNotice)}</p>
          <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#475569;">If the button does not work, copy and paste this URL into your browser:</p>
          <p style="margin:0 0 24px;word-break:break-word;font-size:14px;line-height:1.7;color:#1d4ed8;">${actionUrl}</p>
          <p style="margin:0;font-size:14px;line-height:1.7;color:#475569;">${this.escapeHtml(input.outro)}</p>
        </div>
      </div>
    `.trim();
  }

  private formatResetDurationLabel() {
    return `${env.RESET_TOKEN_TTL_MINUTES} minute${env.RESET_TOKEN_TTL_MINUTES === 1 ? "" : "s"}`;
  }

  private formatVerificationDurationLabel() {
    return `${env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS} hour${env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS === 1 ? "" : "s"}`;
  }

  private escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}
