import { Prisma, type PrismaClient, type UserRole } from "@prisma/client";

import { StaffAccessService } from "./StaffAccessService.js";

export class DashboardService {
  private readonly staffAccessService: StaffAccessService;

  constructor(private readonly db: PrismaClient) {
    this.staffAccessService = new StaffAccessService(db);
  }

  async getDashboardData(currentUser: { id: number; role: UserRole }) {
    const user = await this.db.user.findUnique({
      where: { id: currentUser.id },
      select: {
        id: true,
        role: true,
        status: true
      }
    });

    if (!user) {
      return null;
    }

    switch (user.role) {
      case "STUDENT":
        return this.getStudentDashboard(currentUser.id);
      case "LABORATORY_STAFF":
        return this.getStaffDashboard(currentUser.id);
      default:
        return this.getAdminDashboard();
    }
  }

  private async getAdminDashboard() {
    const [userCount, laboratoryCount, reservationCount, reservationsByStatus, recentActivity] =
      await Promise.all([
        this.db.user.count(),
        this.db.laboratory.count(),
        this.db.reservation.count(),
        this.db.reservation.groupBy({
          by: ["status"],
          _count: {
            status: true
          }
        }),
        this.db.activityLog.findMany({
          take: 8,
          orderBy: { timestamp: "desc" },
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                role: true
              }
            },
            laboratory: {
              select: {
                roomCode: true
              }
            }
          }
        })
      ]);

    const trends = await this.buildReservationTrend();

    return {
      scope: "admin",
      totals: {
        users: userCount,
        laboratories: laboratoryCount,
        reservations: reservationCount,
        pending: this.countStatus(reservationsByStatus, "PENDING"),
        approved: this.countStatus(reservationsByStatus, "APPROVED"),
        completed: this.countStatus(reservationsByStatus, "COMPLETED")
      },
      reservationsByStatus,
      trends,
      recentActivity
    };
  }

  private async getStaffDashboard(staffId: number) {
    const assignedLabIds = await this.staffAccessService.getAssignedLabIds(staffId);

    const [reservationCount, reservationsByStatus, recentActivity, laboratoryCount] =
      await Promise.all([
        this.db.reservation.count({
          where: {
            laboratoryId: {
              in: assignedLabIds
            }
          }
        }),
        this.db.reservation.groupBy({
          by: ["status"],
          where: {
            laboratoryId: {
              in: assignedLabIds
            }
          },
          _count: {
            status: true
          }
        }),
        this.db.activityLog.findMany({
          take: 8,
          where: {
            labId: {
              in: assignedLabIds
            }
          },
          orderBy: { timestamp: "desc" }
        }),
        this.db.laboratory.count({
          where: {
            id: {
              in: assignedLabIds
            }
          }
        })
      ]);

    const trends = await this.buildReservationTrend(assignedLabIds);

    return {
      scope: "staff",
      totals: {
        reservations: reservationCount,
        pending: this.countStatus(reservationsByStatus, "PENDING"),
        approved: this.countStatus(reservationsByStatus, "APPROVED"),
        rejected: this.countStatus(reservationsByStatus, "REJECTED"),
        completed: this.countStatus(reservationsByStatus, "COMPLETED"),
        laboratories: laboratoryCount
      },
      reservationsByStatus,
      trends,
      recentActivity
    };
  }

  private async getStudentDashboard(studentId: number) {
    const [reservationsByStatus, recentReservations, availableLaboratories] = await Promise.all([
      this.db.reservation.groupBy({
        by: ["status"],
        where: { studentId },
        _count: {
          status: true
        }
      }),
      this.db.reservation.findMany({
        where: { studentId },
        take: 5,
        orderBy: [{ reservationDate: "desc" }, { startTime: "desc" }],
        include: {
          laboratory: {
            select: {
              id: true,
              name: true,
              roomCode: true
            }
          },
          pc: {
            select: {
              id: true,
              pcNumber: true,
              status: true
            }
          }
        }
      }),
      this.db.laboratory.count({
        where: {
          status: "AVAILABLE"
        }
      })
    ]);

    return {
      scope: "student",
      totals: {
        pending: this.countStatus(reservationsByStatus, "PENDING"),
        approved: this.countStatus(reservationsByStatus, "APPROVED"),
        completed: this.countStatus(reservationsByStatus, "COMPLETED"),
        availableLaboratories
      },
      reservationsByStatus,
      recentReservations
    };
  }

  private async buildReservationTrend(laboratoryIds?: number[]) {
    if (laboratoryIds && laboratoryIds.length === 0) {
      return [];
    }

    const since = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7);
    const rows = laboratoryIds
      ? await this.db.$queryRaw<Array<{ date: Date | string; count: bigint }>>`
          SELECT DATE("createdAt") AS date, COUNT(*)::bigint AS count
          FROM "Reservation"
          WHERE "createdAt" >= ${since}
            AND "laboratoryId" IN (${Prisma.join(laboratoryIds)})
          GROUP BY DATE("createdAt")
          ORDER BY DATE("createdAt") ASC
        `
      : await this.db.$queryRaw<Array<{ date: Date | string; count: bigint }>>`
          SELECT DATE("createdAt") AS date, COUNT(*)::bigint AS count
          FROM "Reservation"
          WHERE "createdAt" >= ${since}
          GROUP BY DATE("createdAt")
          ORDER BY DATE("createdAt") ASC
        `;

    return rows.map((row) => ({
      date:
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : row.date.slice(0, 10),
      count: Number(row.count)
    }));
  }

  private countStatus(
    items: Array<{ status: string; _count: { status: number } }>,
    status: string
  ) {
    return items.find((item) => item.status === status)?._count.status ?? 0;
  }
}
