import { UserRole } from "@prisma/client";

import { createUserSchema, updateUserSchema } from "../src/validations/user.validation.js";

const createBaseBody = () => ({
  firstName: "Ada",
  lastName: "Lovelace",
  email: "ada@comlab.edu",
  password: "Password123!",
  department: "CIT"
});

describe("user validation", () => {
  it("accepts admin creation without student-only fields", () => {
    const result = createUserSchema.safeParse({
      body: {
        ...createBaseBody(),
        role: UserRole.ADMIN
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
        role: UserRole.LABORATORY_STAFF
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
});
