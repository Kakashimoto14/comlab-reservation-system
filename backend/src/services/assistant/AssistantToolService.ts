import dayjs from "dayjs";
import type { PrismaClient, ReservationStatus, UserRole } from "@prisma/client";

import { toDateOnly } from "../../utils/time.js";
import { ScheduleService } from "../ScheduleService.js";
import { StaffAccessService } from "../StaffAccessService.js";
import { ScheduleLookupService } from "./ScheduleLookupService.js";
import type {
  AssistantCapabilityMatrix,
  CurrentUser,
  CurrentUserContextResult,
  DateRange,
  LaboratoryAvailabilityResult,
  LaboratoryLookupResult,
  LaboratorySummary,
  NotificationsContextResult,
  RecentActivityContextResult,
  ReservationResultsContext,
  ReservationSummary,
  ScheduleAvailabilityResult,
  StaffDirectoryContextResult,
  SystemInfoContextResult,
  SystemStatsContextResult
} from "./types.js";

const reservationSummaryInclude = {
  laboratory: {
    select: {
      name: true,
      roomCode: true
    }
  },
  pc: {
    select: {
      pcNumber: true
    }
  },
  student: {
    select: {
      firstName: true,
      lastName: true,
      studentNumber: true
    }
  },
  reviewedBy: {
    select: {
      firstName: true,
      lastName: true
    }
  }
} as const;

export class AssistantToolService {
  private readonly lookupService: ScheduleLookupService;
  private readonly scheduleService: ScheduleService;
  private readonly staffAccessService: StaffAccessService;

  constructor(private readonly db: PrismaClient) {
    this.lookupService = new ScheduleLookupService(db);
    this.scheduleService = new ScheduleService(db);
    this.staffAccessService = new StaffAccessService(db);
  }

  listLaboratories() {
    return this.lookupService.listLaboratories();
  }

  getLaboratorySuggestions(limit?: number) {
    return this.lookupService.getLaboratorySuggestions(limit);
  }

  getCurrentUserContext(currentUser: CurrentUser): Promise<CurrentUserContextResult | null> {
    return this.lookupService.getCurrentUserContext(currentUser);
  }

  async getRoleCapabilities(currentUser: CurrentUser): Promise<AssistantCapabilityMatrix> {
    const assignedLabIds =
      currentUser.role === "LABORATORY_STAFF"
        ? await this.staffAccessService.getAssignedLabIds(currentUser.id)
        : [];

    if (currentUser.role === "ADMIN") {
      return {
        role: currentUser.role,
        read: [
          "Current account and role",
          "All laboratories and their statuses",
          "All visible schedules and availability",
          "All reservations and pending queues",
          "System summaries and analytics",
          "Recent activity logs and notifications"
        ],
        write: [
          "Create or bulk create schedules",
          "Approve or reject reservations",
          "Bulk approve or reject filtered reservations",
          "Create, update, deactivate, or delete laboratories when safe"
        ],
        denied: [],
        notes: [
          "High-risk bulk actions require an exact confirmation phrase.",
          "Laboratory deletion is blocked when historical dependencies exist."
        ]
      };
    }

    if (currentUser.role === "LABORATORY_STAFF") {
      return {
        role: currentUser.role,
        read: [
          "Current account and role",
          assignedLabIds.length
            ? "Reservations, schedules, and summaries for assigned laboratories"
            : "No assigned laboratory data is currently available",
          "Pending reservations needing review",
          "Notifications and recent activity for handled laboratories"
        ],
        write: [
          assignedLabIds.length
            ? "Create or bulk create schedules for assigned laboratories"
            : "No write actions until a laboratory is assigned",
          assignedLabIds.length
            ? "Approve or reject reservations for assigned laboratories"
            : "No reservation review actions until a laboratory is assigned"
        ],
        denied: [
          "Whole-system user management",
          "Admin-only laboratory management",
          "Reservation review outside assigned laboratories"
        ],
        notes: [
          assignedLabIds.length
            ? `You currently manage ${assignedLabIds.length} laboratory${assignedLabIds.length === 1 ? "" : "ies"}.`
            : "Ask an admin to assign a laboratory before using staff approval or schedule actions."
        ]
      };
    }

    return {
      role: currentUser.role,
      read: [
        "Current account and role",
        "Own reservations and notifications",
        "Available laboratories and schedules",
        "Reservation rules and system help"
      ],
      write: [
        "Create a reservation request",
        "Cancel an eligible pending reservation"
      ],
      denied: [
        "Approving or rejecting reservations",
        "Creating schedules",
        "Managing laboratories",
        "Viewing other users' private reservation data"
      ],
      notes: ["Your role can only access your own reservation records."]
    };
  }

  getRules() {
    return this.lookupService.getRules();
  }

  getSystemInfo(): Promise<SystemInfoContextResult> {
    return this.lookupService.getSystemInfo();
  }

  getGeneralHelpContext(range: DateRange) {
    return this.lookupService.getGeneralHelpContext(range);
  }

  getNotificationsForCurrentUser(
    currentUser: CurrentUser,
    options?: { unreadOnly?: boolean; limit?: number }
  ): Promise<NotificationsContextResult> {
    return this.lookupService.getNotificationsContext(currentUser, options);
  }

  getSystemStatsForRole(currentUser: CurrentUser): Promise<SystemStatsContextResult | null> {
    return this.lookupService.getSystemStatsForRole(currentUser);
  }

  getActivityLogsForRole(
    currentUser: CurrentUser,
    options?: { limit?: number }
  ): Promise<RecentActivityContextResult | null> {
    return this.lookupService.getRecentActivity(currentUser, options);
  }

  getStaffDirectory(
    currentUser: CurrentUser,
    options?: { limit?: number }
  ): Promise<StaffDirectoryContextResult | null> {
    return this.lookupService.getStaffDirectory(currentUser, options);
  }

  getScheduleAvailability(
    range: DateRange,
    options?: { laboratoryId?: number; offset?: number; limit?: number }
  ): Promise<ScheduleAvailabilityResult> {
    return this.lookupService.getScheduleAvailability(range, options);
  }

  getLaboratoryAvailability(
    range: DateRange,
    options?: { offset?: number; limit?: number }
  ): Promise<LaboratoryAvailabilityResult> {
    return this.lookupService.getLaboratoryAvailability(range, options);
  }

  getLaboratoryLookup(laboratory: LaboratorySummary): Promise<LaboratoryLookupResult> {
    return this.lookupService.getLaboratoryLookup(laboratory);
  }

  getReservationsForCurrentUser(
    currentUser: CurrentUser,
    range: DateRange,
    options?: {
      latestOnly?: boolean;
      upcomingOnly?: boolean;
      statuses?: ReservationStatus[];
      take?: number;
      orderBy?: "asc" | "desc";
    }
  ) {
    return this.lookupService.getUserReservations(currentUser, range, options);
  }

  async getReservationsForRole(
    currentUser: CurrentUser,
    range: DateRange,
    options?: {
      statuses?: ReservationStatus[];
      laboratoryId?: number;
      limit?: number;
      orderBy?: "asc" | "desc";
    }
  ): Promise<ReservationResultsContext | null> {
    if (currentUser.role === "STUDENT") {
      return null;
    }

    const where = await this.buildVisibleReservationWhere(currentUser, {
      laboratoryId: options?.laboratoryId,
      range,
      statuses: options?.statuses
    });
    const reservations = await this.db.reservation.findMany({
      where,
      include: reservationSummaryInclude,
      orderBy:
        options?.orderBy === "desc"
          ? [{ reservationDate: "desc" }, { startTime: "desc" }]
          : [{ reservationDate: "asc" }, { startTime: "asc" }],
      take: options?.limit ?? 10
    });

    return {
      rangeLabel: range.label,
      reservations: reservations.map((reservation) => this.mapReservationSummary(reservation))
    };
  }

  async getPendingReservations(
    currentUser: CurrentUser,
    range: DateRange,
    options?: {
      laboratoryId?: number;
      limit?: number;
    }
  ) {
    return this.getReservationsForRole(currentUser, range, {
      laboratoryId: options?.laboratoryId,
      limit: options?.limit,
      statuses: ["PENDING"]
    });
  }

  async getReservationByIdOrReference(
    currentUser: CurrentUser,
    options: {
      reservationCode?: string;
      reservationId?: number;
      laboratoryId?: number;
      range?: DateRange;
      status?: ReservationStatus;
      startTime?: string;
      latest?: boolean;
      ownOnly?: boolean;
    }
  ): Promise<ReservationSummary | null> {
    const baseWhere =
      options.ownOnly || currentUser.role === "STUDENT"
        ? {
            studentId: currentUser.id
          }
        : await this.buildVisibleReservationWhere(currentUser, {
            laboratoryId: options.laboratoryId,
            range: options.range,
            statuses: options.status ? [options.status] : undefined
          });

    const reservation = await this.db.reservation.findFirst({
      where: {
        ...baseWhere,
        ...(options.reservationCode ? { reservationCode: options.reservationCode } : {}),
        ...(typeof options.reservationId === "number" ? { id: options.reservationId } : {}),
        ...(options.startTime ? { startTime: options.startTime } : {}),
        ...(options.status && !("status" in baseWhere) ? { status: options.status } : {})
      },
      include: reservationSummaryInclude,
      orderBy: options.latest ? [{ createdAt: "desc" }] : [{ reservationDate: "asc" }, { startTime: "asc" }]
    });

    return reservation ? this.mapReservationSummary(reservation) : null;
  }

  async getAssignedLaboratory(currentUser: CurrentUser) {
    if (currentUser.role !== "LABORATORY_STAFF") {
      return null;
    }

    return this.db.laboratory.findFirst({
      where: {
        custodianId: currentUser.id
      },
      select: {
        id: true,
        name: true,
        roomCode: true,
        building: true,
        status: true
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
  }

  async getManagedLaboratories(currentUser: CurrentUser) {
    if (currentUser.role !== "LABORATORY_STAFF") {
      return [];
    }

    return this.db.laboratory.findMany({
      where: {
        custodianId: currentUser.id
      },
      select: {
        id: true,
        name: true,
        roomCode: true,
        building: true,
        status: true
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
  }

  async getLaboratoryCatalog(filters?: { status?: LaboratorySummary["status"] }) {
    const laboratories = await this.db.laboratory.findMany({
      where: filters?.status ? { status: filters.status } : undefined,
      select: {
        id: true,
        name: true,
        roomCode: true,
        building: true,
        status: true,
        capacity: true,
        computerCount: true,
        custodian: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });

    return laboratories.map((laboratory) => ({
      id: laboratory.id,
      name: laboratory.name,
      roomCode: laboratory.roomCode,
      building: laboratory.building,
      status: laboratory.status,
      capacity: laboratory.capacity,
      computerCount: laboratory.computerCount,
      assignedStaffName: laboratory.custodian
        ? `${laboratory.custodian.firstName} ${laboratory.custodian.lastName}`.trim()
        : null
    }));
  }

  async getUsageAnalyticsForRole(
    currentUser: CurrentUser,
    range: DateRange,
    options?: { laboratoryId?: number }
  ) {
    const rangeWhere =
      currentUser.role === "STUDENT"
        ? {
            studentId: currentUser.id,
            reservationDate: {
              gte: dayjs(range.start).startOf("day").toDate(),
              lte: dayjs(range.end).endOf("day").toDate()
            }
          }
        : await this.buildVisibleReservationWhere(currentUser, {
            laboratoryId: options?.laboratoryId,
            range
          });

    const reservations = await this.db.reservation.findMany({
      where: rangeWhere,
      select: {
        status: true,
        reservationDate: true,
        laboratoryId: true,
        laboratory: {
          select: {
            name: true,
            roomCode: true
          }
        }
      }
    });

    const totals = {
      total: reservations.length,
      pending: reservations.filter((reservation) => reservation.status === "PENDING").length,
      approved: reservations.filter((reservation) => reservation.status === "APPROVED").length,
      rejected: reservations.filter((reservation) => reservation.status === "REJECTED").length,
      cancelled: reservations.filter((reservation) => reservation.status === "CANCELLED").length,
      completed: reservations.filter((reservation) => reservation.status === "COMPLETED").length
    };

    const byLaboratory = new Map<string, number>();
    const byDate = new Map<string, number>();

    for (const reservation of reservations) {
      const laboratoryLabel = `${reservation.laboratory.roomCode} - ${reservation.laboratory.name}`;
      byLaboratory.set(laboratoryLabel, (byLaboratory.get(laboratoryLabel) ?? 0) + 1);

      const dateKey = dayjs(toDateOnly(reservation.reservationDate)).format("YYYY-MM-DD");
      byDate.set(dateKey, (byDate.get(dateKey) ?? 0) + 1);
    }

    const mostUsedLab = [...byLaboratory.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;
    const busiestDay = [...byDate.entries()].sort((left, right) => right[1] - left[1])[0] ?? null;

    return {
      totals,
      mostUsedLab,
      busiestDay
    };
  }

  async findMatchingSchedule(laboratoryId: number, date: string, startTime: string, endTime: string) {
    return this.scheduleService.findMatchingSchedule(laboratoryId, date, startTime, endTime);
  }

  async getLaboratoryDependencies(laboratoryId: number) {
    const [reservations, schedules, calendarEvents, activityLogs] = await Promise.all([
      this.db.reservation.count({ where: { laboratoryId } }),
      this.db.schedule.count({ where: { laboratoryId } }),
      this.db.calendarEvent.count({ where: { laboratoryId } }),
      this.db.activityLog.count({ where: { labId: laboratoryId } })
    ]);

    return {
      reservations,
      schedules,
      calendarEvents,
      activityLogs
    };
  }

  private async buildVisibleReservationWhere(
    currentUser: CurrentUser,
    input: {
      laboratoryId?: number;
      range?: DateRange;
      statuses?: ReservationStatus[];
    }
  ) {
    const dateWhere = input.range
      ? {
          reservationDate: {
            gte: dayjs(input.range.start).startOf("day").toDate(),
            lte: dayjs(input.range.end).endOf("day").toDate()
          }
        }
      : {};
    const statusWhere = input.statuses?.length
      ? {
          status: {
            in: input.statuses
          }
        }
      : {};

    if (currentUser.role === "ADMIN") {
      return {
        ...dateWhere,
        ...statusWhere,
        ...(typeof input.laboratoryId === "number" ? { laboratoryId: input.laboratoryId } : {})
      };
    }

    const assignedLabIds = await this.staffAccessService.getAssignedLabIds(currentUser.id);
    const laboratoryIds =
      typeof input.laboratoryId === "number"
        ? assignedLabIds.includes(input.laboratoryId)
          ? [input.laboratoryId]
          : []
        : assignedLabIds;

    return {
      ...dateWhere,
      ...statusWhere,
      laboratoryId: {
        in: laboratoryIds
      }
    };
  }

  private mapReservationSummary(
    reservation: {
      id: number;
      reservationCode: string;
      status: ReservationStatus;
      reservationDate: Date;
      startTime: string;
      endTime: string;
      reservationType: ReservationSummary["reservationType"];
      purpose: string;
      remarks: string | null;
      laboratory: {
        name: string;
        roomCode: string;
      };
      pc: {
        pcNumber: string;
      } | null;
      student: {
        firstName: string;
        lastName: string;
        studentNumber: string | null;
      };
      reviewedBy: {
        firstName: string;
        lastName: string;
      } | null;
    }
  ): ReservationSummary {
    return {
      id: reservation.id,
      reservationCode: reservation.reservationCode,
      status: reservation.status,
      date: dayjs(toDateOnly(reservation.reservationDate)).format("YYYY-MM-DD"),
      startTime: reservation.startTime,
      endTime: reservation.endTime,
      laboratoryName: reservation.laboratory.name,
      roomCode: reservation.laboratory.roomCode,
      reservationType: reservation.reservationType,
      pcNumber: reservation.pc?.pcNumber ?? null,
      purpose: reservation.purpose,
      studentName: `${reservation.student.firstName} ${reservation.student.lastName}`.trim(),
      studentNumber: reservation.student.studentNumber ?? null,
      remarks: reservation.remarks ?? null,
      reviewedByName: reservation.reviewedBy
        ? `${reservation.reviewedBy.firstName} ${reservation.reviewedBy.lastName}`.trim()
        : null
    };
  }
}
