import type { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import bcrypt from "bcrypt";

type DemoAccountConfig = {
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  department: string;
  phone: string;
};

const DEMO_PASSWORD = "Password123!";

const demoAccounts: DemoAccountConfig[] = [
  {
    firstName: "Marianne",
    lastName: "Torres",
    email: "admin@comlab.edu",
    role: "ADMIN",
    status: "ACTIVE",
    department: "College of Information Technology",
    phone: "09171234567"
  },
  {
    firstName: "Daniel",
    lastName: "Reyes",
    email: "staff@comlab.edu",
    role: "LABORATORY_STAFF",
    status: "ACTIVE",
    department: "Computer Laboratory Office",
    phone: "09179876543"
  }
];

export class SystemBootstrapService {
  constructor(private readonly db: PrismaClient) {}

  async ensureDemoAccounts() {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    await Promise.all(
      demoAccounts.map((account) =>
        this.db.user.upsert({
          where: { email: account.email },
          create: {
            ...account,
            passwordHash
          },
          update: {
            ...account,
            passwordHash
          }
        })
      )
    );
  }
}
