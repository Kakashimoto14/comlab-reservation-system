import type { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        id: number;
        sessionId: number;
        email: string;
        role: UserRole;
      };
    }
  }
}

export {};
