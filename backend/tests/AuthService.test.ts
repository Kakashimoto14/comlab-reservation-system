import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";

import { AuthService } from "../src/services/AuthService.js";

const createMockDb = () => {
  const db = {
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    emailVerificationToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    authSession: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn()
    },
    activityLog: {
      create: vi.fn()
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn()
  } as any;

  db.$transaction.mockImplementation(async (input: unknown) => {
    if (typeof input === "function") {
      return input(db);
    }

    return Promise.all(input as Promise<unknown>[]);
  });

  return db;
};

describe("AuthService", () => {
  it("registers a student and prepares an email verification link", async () => {
    const db = createMockDb();
    db.user.findFirst.mockResolvedValue(null);
    db.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 10,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      emailVerifiedAt: data.emailVerifiedAt ?? null,
      passwordHash: data.passwordHash,
      role: "STUDENT",
      status: "ACTIVE",
      studentNumber: data.studentNumber,
      department: data.department,
      yearLevel: data.yearLevel,
      phone: data.phone,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    const service = new AuthService(db);

    const result = await service.registerStudent({
      firstName: "Alyssa",
      lastName: "Cruz",
      email: "alyssa@student.edu",
      password: "Password123!",
      studentNumber: "24-00001",
      department: "BS Information Technology",
      yearLevel: 2,
      phone: "09171234567"
    });

    expect(result.message).toContain("verify your account before logging in");
    expect(result.previewVerificationUrl).toContain("/verify-email?token=");
    expect(db.emailVerificationToken.create).toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalled();
  });

  it("rejects login when the user account is deactivated", async () => {
    const db = createMockDb();
    const passwordHash = await bcrypt.hash("Password123!", 10);
    db.user.findUnique.mockResolvedValue({
      id: 1,
      firstName: "Dormant",
      lastName: "Student",
      email: "inactive@student.edu",
      emailVerifiedAt: new Date(),
      passwordHash,
      role: "STUDENT",
      status: "DEACTIVATED",
      studentNumber: "24-00009",
      department: "BSIT",
      yearLevel: 2,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const service = new AuthService(db);

    await expect(
      service.login({
        email: "inactive@student.edu",
        password: "Password123!"
      })
    ).rejects.toMatchObject({
      statusCode: StatusCodes.FORBIDDEN
    });
  });

  it("rejects login when the user email is not verified", async () => {
    const db = createMockDb();
    const passwordHash = await bcrypt.hash("Password123!", 10);
    db.user.findUnique.mockResolvedValue({
      id: 2,
      firstName: "Pending",
      lastName: "Student",
      email: "pending@student.edu",
      emailVerifiedAt: null,
      passwordHash,
      role: "STUDENT",
      status: "ACTIVE",
      studentNumber: "24-00010",
      department: "BSIT",
      yearLevel: 2,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const service = new AuthService(db);

    await expect(
      service.login({
        email: "pending@student.edu",
        password: "Password123!"
      })
    ).rejects.toMatchObject({
      statusCode: StatusCodes.FORBIDDEN
    });
  });

  it("prepares a preview reset link for an active account", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue({
      id: 2,
      firstName: "Marianne",
      lastName: "Torres",
      email: "admin@comlab.edu",
      emailVerifiedAt: new Date(),
      passwordHash: "hash",
      role: "ADMIN",
      status: "ACTIVE",
      studentNumber: null,
      department: "CIT",
      yearLevel: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const service = new AuthService(db);
    const result = await service.forgotPassword({ email: "admin@comlab.edu" });

    expect(result.message).toContain("If an account exists");
    expect(result.previewResetUrl).toContain("/reset-password?token=");
    expect(db.passwordResetToken.create).toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalled();
  });

  it("revokes the active session on logout even without a refresh cookie", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue({
      id: 9,
      firstName: "Marco",
      lastName: "Staff",
      email: "staff@comlab.edu",
      emailVerifiedAt: new Date(),
      passwordHash: "hash",
      role: "LABORATORY_STAFF",
      status: "ACTIVE",
      studentNumber: null,
      department: "ICS",
      yearLevel: null,
      phone: null,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    const service = new AuthService(db);
    const result = await service.logoutSession(9, 41, null);

    expect(result.message).toBe("Logged out successfully.");
    expect(db.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        id: 41,
        revokedAt: null
      },
      data: {
        revokedAt: expect.any(Date)
      }
    });
    expect(db.activityLog.create).toHaveBeenCalled();
  });

  it("verifies a valid email verification token", async () => {
    const db = createMockDb();
    db.emailVerificationToken.findUnique.mockResolvedValue({
      id: 11,
      userId: 5,
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: null,
      user: {
        id: 5,
        firstName: "Lorraine",
        lastName: "Mendoza",
        email: "lorraine@student.edu",
        emailVerifiedAt: null,
        passwordHash: "hash",
        role: "STUDENT",
        status: "ACTIVE",
        studentNumber: "24-00022",
        department: "BSIT",
        yearLevel: 2,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    db.user.update.mockResolvedValue({});
    db.emailVerificationToken.update.mockResolvedValue({});
    db.emailVerificationToken.deleteMany.mockResolvedValue({});

    const service = new AuthService(db);
    const result = await service.verifyEmail({
      token: "12345678901234567890-valid-token"
    });

    expect(result.message).toBe("Email verified successfully. You can now log in.");
    expect(db.user.update).toHaveBeenCalled();
    expect(db.emailVerificationToken.update).toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalled();
  });

  it("returns a friendly message when an already-used verification link is clicked again", async () => {
    const db = createMockDb();
    db.emailVerificationToken.findUnique.mockResolvedValue({
      id: 12,
      userId: 6,
      tokenHash: "hashed-token",
      expiresAt: new Date(Date.now() + 60_000),
      usedAt: new Date(),
      user: {
        id: 6,
        firstName: "Alyssa",
        lastName: "Cruz",
        email: "alyssa@student.edu",
        emailVerifiedAt: new Date(),
        passwordHash: "hash",
        role: "STUDENT",
        status: "ACTIVE",
        studentNumber: "24-00001",
        department: "BSIT",
        yearLevel: 2,
        phone: null,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });

    const service = new AuthService(db);

    await expect(
      service.verifyEmail({
        token: "12345678901234567890-valid-token"
      })
    ).rejects.toMatchObject({
      statusCode: StatusCodes.CONFLICT,
      message: "This email is already verified. You can log in to your ComPort account."
    });
  });
});
