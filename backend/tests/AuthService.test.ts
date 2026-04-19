import bcrypt from "bcrypt";
import { StatusCodes } from "http-status-codes";

import { AuthService } from "../src/services/AuthService.js";
import { ApiError } from "../src/utils/ApiError.js";

const createMockDb = () =>
  ({
    user: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn()
    },
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    },
    activityLog: {
      create: vi.fn()
    },
    $transaction: vi.fn(async (operations: Promise<unknown>[]) => Promise.all(operations))
  }) as any;

describe("AuthService", () => {
  it("registers a student and returns a token with a safe user object", async () => {
    const db = createMockDb();
    db.user.findFirst.mockResolvedValue(null);
    db.user.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
      id: 10,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
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
    db.user.findUnique.mockImplementation(async ({ where }: { where: { id: number } }) =>
      where.id === 10
        ? {
            id: 10,
            firstName: "Alyssa",
            lastName: "Cruz",
            email: "alyssa@student.edu",
            passwordHash: "hidden",
            role: "STUDENT",
            status: "ACTIVE",
            studentNumber: "2024-0001",
            department: "BS Information Technology",
            yearLevel: 2,
            phone: "09171234567",
            createdAt: new Date(),
            updatedAt: new Date()
          }
        : null
    );

    const service = new AuthService(db);

    const result = await service.registerStudent({
      firstName: "Alyssa",
      lastName: "Cruz",
      email: "alyssa@student.edu",
      password: "Password123!",
      studentNumber: "2024-0001",
      department: "BS Information Technology",
      yearLevel: 2,
      phone: "09171234567"
    });

    expect(result.token).toBeTypeOf("string");
    expect(result.user.email).toBe("alyssa@student.edu");
    expect("passwordHash" in result.user).toBe(false);
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
      passwordHash,
      role: "STUDENT",
      status: "DEACTIVATED",
      studentNumber: "2024-0009",
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

  it("prepares a preview reset link for an active account", async () => {
    const db = createMockDb();
    db.user.findUnique.mockResolvedValue({
      id: 2,
      firstName: "Marianne",
      lastName: "Torres",
      email: "admin@comlab.edu",
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

    expect(result.message).toContain("If an account with that email exists");
    expect(result.previewResetUrl).toContain("/reset-password?token=");
    expect(db.passwordResetToken.create).toHaveBeenCalled();
    expect(db.activityLog.create).toHaveBeenCalled();
  });
});
