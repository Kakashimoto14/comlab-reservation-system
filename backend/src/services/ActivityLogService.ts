import type { PrismaClient, Prisma as PrismaNamespace } from "@prisma/client";

type DbClient = PrismaClient | PrismaNamespace.TransactionClient;

export class ActivityLogService {
  constructor(private readonly db: DbClient) {}

  async logActivity(input: {
    userId?: number | null;
    labId?: number | null;
    pcId?: number | null;
    action: string;
    entityType?: string;
    entityId?: number | null;
    description: string;
    metadata?: PrismaNamespace.InputJsonValue;
    timestamp?: Date;
  }) {
    return this.db.activityLog.create({
      data: {
        userId: input.userId ?? null,
        labId: input.labId ?? null,
        pcId: input.pcId ?? null,
        action: input.action,
        entityType: input.entityType ?? "SYSTEM",
        entityId: input.entityId ?? null,
        description: input.description,
        metadata: input.metadata,
        ...(input.timestamp ? { timestamp: input.timestamp } : {})
      }
    });
  }
}
