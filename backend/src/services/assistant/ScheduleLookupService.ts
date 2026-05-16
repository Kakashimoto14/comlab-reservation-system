import dayjs from "dayjs";
import type {
  PrismaClient,
  ReservationStatus
} from "@prisma/client";

import { toDateOnly } from "../../utils/time.js";
import type {
  CalendarNote,
  CurrentUser,
  DateRange,
  GeneralHelpContext,
  LaboratoryAvailabilityResult,
  LaboratoryLookupResult,
  LaboratorySummary,
  ReservationResultsContext,
  ReservationRule,
  ReservationSummary,
  ScheduleAvailability,
  ScheduleAvailabilityResult,
  TimeWindow
} from "./types.js";

const ACTIVE_AVAILABILITY_STATUSES: ReservationStatus[] = [
  "PENDING",
  "APPROVED",
  "COMPLETED"
];

const MIN_OPEN_WINDOW_MINUTES = 30;
const DEFAULT_SCHEDULE_PAGE_SIZE = 6;
const DEFAULT_LAB_PAGE_SIZE = 5;

const RULES: ReservationRule[] = [
  {
    title: "Published schedule blocks only",
    detail:
      "Reservations must stay inside a schedule with AVAILABLE status for the selected laboratory."
  },
  {
    title: "Valid time range",
    detail: "The reservation end time must be later than the start time."
  },
  {
    title: "Whole-lab conflicts",
    detail:
      "A whole-laboratory reservation cannot overlap any active reservation in the same laboratory and date."
  },
  {
    title: "PC conflicts",
    detail:
      "A PC reservation requires an AVAILABLE PC and cannot overlap the same PC or a whole-laboratory booking."
  },
  {
    title: "Pending review flow",
    detail:
      "Student reservations are submitted as pending and are reviewed by administrators or assigned laboratory staff."
  },
  {
    title: "Student cancellation",
    detail: "Students can cancel only their own pending reservations."
  }
];

export class ScheduleLookupService {
  constructor(private readonly db: PrismaClient) {}

  async listLaboratories(): Promise<LaboratorySummary[]> {
    return this.db.laboratory.findMany({
      select: {
        id: true,
        name: true,
        roomCode: true,
        building: true,
        location: true,
        description: true,
        status: true
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
  }

  async getLaboratorySuggestions(limit = 3) {
    const laboratories = await this.db.laboratory.findMany({
      select: {
        name: true,
        roomCode: true
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }],
      take: limit
    });

    return laboratories.map((laboratory) => `${laboratory.name} (${laboratory.roomCode})`);
  }

  async getRules() {
    return RULES;
  }

  async getGeneralHelpContext(range: DateRange): Promise<GeneralHelpContext> {
    const bounds = this.toQueryBounds(range);
    const [availableLaboratories, scheduleCount] = await Promise.all([
      this.db.laboratory.count({
        where: {
          status: "AVAILABLE"
        }
      }),
      this.db.schedule.count({
        where: {
          status: "AVAILABLE",
          date: {
            gte: bounds.start,
            lte: bounds.end
          }
        }
      })
    ]);

    return {
      rangeLabel: range.label,
      availableLaboratories,
      scheduleCount
    };
  }

  async getUserReservations(
    currentUser: CurrentUser,
    range: DateRange
  ): Promise<ReservationResultsContext> {
    const bounds = this.toQueryBounds(range);
    const reservations = await this.db.reservation.findMany({
      where: {
        studentId: currentUser.id,
        reservationDate: {
          gte: bounds.start,
          lte: bounds.end
        }
      },
      include: {
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
        }
      },
      orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }],
      take: 12
    });

    return {
      rangeLabel: range.label,
      reservations: reservations.map((reservation): ReservationSummary => ({
        reservationCode: reservation.reservationCode,
        status: reservation.status,
        date: this.toIsoDate(reservation.reservationDate),
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        laboratoryName: reservation.laboratory.name,
        roomCode: reservation.laboratory.roomCode,
        reservationType: reservation.reservationType,
        pcNumber: reservation.pc?.pcNumber ?? null,
        purpose: reservation.purpose
      }))
    };
  }

  async getLaboratoryLookup(laboratory: LaboratorySummary): Promise<LaboratoryLookupResult> {
    return {
      laboratory
    };
  }

  async getScheduleAvailability(
    range: DateRange,
    options?: { laboratoryId?: number; offset?: number; limit?: number }
  ): Promise<ScheduleAvailabilityResult> {
    const { schedules, calendarNotes } = await this.loadScheduleAvailability(
      range,
      options?.laboratoryId
    );
    const openSchedules = schedules.filter((schedule) => schedule.freeWindows.length > 0);
    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? DEFAULT_SCHEDULE_PAGE_SIZE;
    const pagedSchedules = openSchedules.slice(offset, offset + limit);

    return {
      rangeLabel: range.label,
      schedules: pagedSchedules,
      totalCount: openSchedules.length,
      hasMore: offset + limit < openSchedules.length,
      calendarNotes
    };
  }

  async getLaboratoryAvailability(
    range: DateRange,
    options?: { offset?: number; limit?: number }
  ): Promise<LaboratoryAvailabilityResult> {
    const { schedules, calendarNotes } = await this.loadScheduleAvailability(range);
    const groupedByLaboratory = new Map<number, ScheduleAvailability[]>();

    for (const schedule of schedules) {
      groupedByLaboratory.set(schedule.laboratoryId, [
        ...(groupedByLaboratory.get(schedule.laboratoryId) ?? []),
        schedule
      ]);
    }

    const laboratories = Array.from(groupedByLaboratory.values())
      .filter((laboratorySchedules) =>
        laboratorySchedules.some((schedule) => schedule.freeWindows.length > 0)
      )
      .map((laboratorySchedules) => ({
        laboratoryName: laboratorySchedules[0].laboratoryName,
        roomCode: laboratorySchedules[0].roomCode,
        building: laboratorySchedules[0].building,
        nextOpenWindows: laboratorySchedules
          .flatMap((schedule) =>
            schedule.freeWindows.map((window) => ({
              date: schedule.date,
              startTime: window.startTime,
              endTime: window.endTime
            }))
          )
          .slice(0, 3)
      }));

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? DEFAULT_LAB_PAGE_SIZE;

    return {
      rangeLabel: range.label,
      laboratories: laboratories.slice(offset, offset + limit),
      totalCount: laboratories.length,
      hasMore: offset + limit < laboratories.length,
      calendarNotes
    };
  }

  private async loadScheduleAvailability(range: DateRange, laboratoryId?: number) {
    const bounds = this.toQueryBounds(range);
    const laboratoryFilter = laboratoryId ? { id: laboratoryId } : undefined;
    const laboratories = await this.db.laboratory.findMany({
      where: laboratoryFilter,
      select: {
        id: true,
        name: true,
        roomCode: true,
        building: true,
        status: true
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });

    if (!laboratories.length) {
      return {
        schedules: [] as ScheduleAvailability[],
        calendarNotes: [] as CalendarNote[]
      };
    }

    const laboratoryIds = laboratories.map((laboratory) => laboratory.id);
    const [schedules, reservations, calendarEvents] = await Promise.all([
      this.db.schedule.findMany({
        where: {
          laboratoryId: {
            in: laboratoryIds
          },
          status: "AVAILABLE",
          date: {
            gte: bounds.start,
            lte: bounds.end
          }
        },
        select: {
          id: true,
          laboratoryId: true,
          date: true,
          startTime: true,
          endTime: true,
          laboratory: {
            select: {
              name: true,
              roomCode: true,
              building: true
            }
          }
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }]
      }),
      this.db.reservation.findMany({
        where: {
          laboratoryId: {
            in: laboratoryIds
          },
          reservationDate: {
            gte: bounds.start,
            lte: bounds.end
          },
          status: {
            in: ACTIVE_AVAILABILITY_STATUSES
          }
        },
        select: {
          scheduleId: true,
          laboratoryId: true,
          reservationDate: true,
          startTime: true,
          endTime: true
        },
        orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }]
      }),
      this.db.calendarEvent.findMany({
        where: {
          date: {
            gte: bounds.start,
            lte: bounds.end
          },
          ...(laboratoryId
            ? {
                OR: [{ laboratoryId }, { laboratoryId: null }]
              }
            : undefined)
        },
        select: {
          title: true,
          type: true,
          date: true,
          startTime: true,
          endTime: true,
          laboratory: {
            select: {
              roomCode: true
            }
          }
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }]
      })
    ]);

    const availability = schedules.map((schedule) => {
      const relevantReservations = reservations.filter((reservation) => {
        if (reservation.laboratoryId !== schedule.laboratoryId) {
          return false;
        }

        if (reservation.scheduleId && reservation.scheduleId !== schedule.id) {
          return false;
        }

        return this.toIsoDate(reservation.reservationDate) === this.toIsoDate(schedule.date);
      });

      return {
        laboratoryId: schedule.laboratoryId,
        laboratoryName: schedule.laboratory.name,
        roomCode: schedule.laboratory.roomCode,
        building: schedule.laboratory.building,
        date: this.toIsoDate(schedule.date),
        scheduleWindow: `${schedule.startTime}-${schedule.endTime}`,
        freeWindows: this.buildFreeWindows(
          {
            startTime: schedule.startTime,
            endTime: schedule.endTime
          },
          relevantReservations.map((reservation) => ({
            startTime: reservation.startTime,
            endTime: reservation.endTime
          }))
        )
      };
    });

    const calendarNotes = calendarEvents.map((event) => ({
      date: this.toIsoDate(event.date),
      title: event.title,
      type: event.type,
      laboratory: event.laboratory?.roomCode ?? null,
      timeWindow:
        event.startTime && event.endTime ? `${event.startTime}-${event.endTime}` : null
    }));

    return {
      schedules: availability,
      calendarNotes
    };
  }

  private buildFreeWindows(schedule: TimeWindow, reservations: TimeWindow[]) {
    const occupiedWindows = this.mergeTimeWindows(
      reservations
        .map((reservation) => this.intersectWindowWithSchedule(schedule, reservation))
        .filter((window): window is TimeWindow => Boolean(window))
    );

    if (!occupiedWindows.length) {
      return [
        {
          startTime: schedule.startTime,
          endTime: schedule.endTime
        }
      ];
    }

    const freeWindows: TimeWindow[] = [];
    let cursor = this.toMinutes(schedule.startTime);
    const scheduleEnd = this.toMinutes(schedule.endTime);

    for (const occupiedWindow of occupiedWindows) {
      const occupiedStart = this.toMinutes(occupiedWindow.startTime);
      const occupiedEnd = this.toMinutes(occupiedWindow.endTime);

      if (cursor < occupiedStart) {
        freeWindows.push({
          startTime: this.toTimeString(cursor),
          endTime: this.toTimeString(occupiedStart)
        });
      }

      cursor = Math.max(cursor, occupiedEnd);
    }

    if (cursor < scheduleEnd) {
      freeWindows.push({
        startTime: this.toTimeString(cursor),
        endTime: this.toTimeString(scheduleEnd)
      });
    }

    return freeWindows.filter(
      (window) =>
        this.toMinutes(window.endTime) - this.toMinutes(window.startTime) >=
        MIN_OPEN_WINDOW_MINUTES
    );
  }

  private mergeTimeWindows(windows: TimeWindow[]) {
    if (!windows.length) {
      return [];
    }

    const sortedWindows = [...windows].sort(
      (left, right) => this.toMinutes(left.startTime) - this.toMinutes(right.startTime)
    );
    const merged: TimeWindow[] = [{ ...sortedWindows[0] }];

    for (const currentWindow of sortedWindows.slice(1)) {
      const lastWindow = merged[merged.length - 1];

      if (this.toMinutes(currentWindow.startTime) <= this.toMinutes(lastWindow.endTime)) {
        lastWindow.endTime =
          this.toMinutes(currentWindow.endTime) > this.toMinutes(lastWindow.endTime)
            ? currentWindow.endTime
            : lastWindow.endTime;
        continue;
      }

      merged.push({ ...currentWindow });
    }

    return merged;
  }

  private intersectWindowWithSchedule(schedule: TimeWindow, reservation: TimeWindow) {
    const startMinutes = Math.max(
      this.toMinutes(schedule.startTime),
      this.toMinutes(reservation.startTime)
    );
    const endMinutes = Math.min(
      this.toMinutes(schedule.endTime),
      this.toMinutes(reservation.endTime)
    );

    if (startMinutes >= endMinutes) {
      return null;
    }

    return {
      startTime: this.toTimeString(startMinutes),
      endTime: this.toTimeString(endMinutes)
    };
  }

  private toMinutes(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  }

  private toTimeString(minutes: number) {
    const hours = Math.floor(minutes / 60)
      .toString()
      .padStart(2, "0");
    const mins = (minutes % 60).toString().padStart(2, "0");

    return `${hours}:${mins}`;
  }

  private toIsoDate(date: Date) {
    return dayjs(toDateOnly(date)).format("YYYY-MM-DD");
  }

  private toQueryBounds(range: DateRange) {
    return {
      start: dayjs(range.start).startOf("day").toDate(),
      end: dayjs(range.end).endOf("day").toDate()
    };
  }
}
