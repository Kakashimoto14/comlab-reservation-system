import { UserRole } from "@prisma/client";

import { createUserSchema, updateUserSchema } from "../src/validations/user.validation.js";

const createBaseBody = () => ({
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@comlab.edu",
  password: "Password123!",
  department: "CIT",
  phone: "09171234567"
});

describe("user validation", () => {
  it("accepts admin creation without student-only fields", () => {
    const result = createUserSchema.safeParse({
      body: {
        ...createBaseBody(),
        role: UserRole.ADMIN,
        studentNumber: null,
        yearLevel: null
      },
      params: {},
      query: {}
    });

    expect(result.success).toBe(true);
  });

  it("accepts laboratory staff creation without student-only fields", () => {
    const result = createUserSchema.safeParse({
      body: {
        ...createBaseBody(),
        role: UserRole.LABORATORY_STAFF,
        studentNumber: null,
        yearLevel: null
      },
      params: {},
      query: {}
    });

    expect(result.success).toBe(true);
  });

  it("requires student-only fields when creating a student", () => {
    const result = createUserSchema.safeParse({
      body: {
        ...createBaseBody(),
        role: UserRole.STUDENT
      },
      params: {},
      query: {}
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const studentNumberIssue = result.error.issues.find(
        (issue) => issue.path.join(".") === "body.studentNumber"
      );
      const yearLevelIssue = result.error.issues.find(
        (issue) => issue.path.join(".") === "body.yearLevel"
      );

      expect(studentNumberIssue?.message).toBe(
        "Student number is required for student accounts."
      );
      expect(yearLevelIssue?.message).toBe("Year level is required for student accounts.");
    }
  });

  it("requires student-only fields when switching a user to student", () => {
    const result = updateUserSchema.safeParse({
      body: {
        role: UserRole.STUDENT
      },
      params: {
        id: 1
      },
      query: {}
    });

    expect(result.success).toBe(false);
  });

  it("rejects malformed names, student numbers, phones, and invalid year levels", () => {
    const result = createUserSchema.safeParse({
      body: {
        ...createBaseBody(),
        firstName: "Ada123",
        role: UserRole.STUDENT,
        studentNumber: "2412345",
        phone: "09999abc",
        yearLevel: 5
      },
      params: {},
      query: {}
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      const issues = result.error.issues.map((issue) => issue.path.join("."));

      expect(issues).toContain("body.firstName");
      expect(issues).toContain("body.studentNumber");
      expect(issues).toContain("body.phone");
      expect(issues).toContain("body.yearLevel");
    }
  });

  it("rejects student-only values for employee accounts", () => {
    const result = createUserSchema.safeParse({
      body: {
        ...createBaseBody(),
        role: UserRole.ADMIN,
        studentNumber: "24-12345",
        yearLevel: 2
      },
      params: {},
      query: {}
    });

    expect(result.success).toBe(false);
  });
});
