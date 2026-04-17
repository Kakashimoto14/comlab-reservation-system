import type { User as PrismaUser } from "@prisma/client";

import { Admin } from "./Admin.js";
import { LaboratoryStaff } from "./LaboratoryStaff.js";
import { Student } from "./Student.js";

export class UserFactory {
  static create(user: PrismaUser) {
    switch (user.role) {
      case "ADMIN":
        return new Admin(user);
      case "LABORATORY_STAFF":
        return new LaboratoryStaff(user);
      default:
        return new Student(user);
    }
  }
}
