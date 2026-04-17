import type { PrismaClient, Prisma as PrismaNamespace } from "@prisma/client";

type DbClient = PrismaClient | PrismaNamespace.TransactionClient;

export class ActivityLogService {
  constructor(private readonly db: DbClient) {}

  async logActivity(input: {
    userId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    description: string;
  }) {
    return this.db.activityLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        description: input.description
      }
    });
  }
}
