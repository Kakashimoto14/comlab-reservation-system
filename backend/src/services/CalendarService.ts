import type { CalendarEventType, PrismaClient } from "@prisma/client";
import { StatusCodes } from "http-status-codes";

import { ApiError } from "../utils/ApiError.js";
import { toDateOnly } from "../utils/time.js";
import { ActivityLogService } from "./ActivityLogService.js";

type CalendarFilters = {
  laboratoryId?: number;
  date?: string;
};

type CalendarEventInput = {
  title: string;
  type: CalendarEventType;
  laboratoryId?: number | null;
  pcId?: number | null;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
};

export class CalendarService {
  private readonly activityLogService: ActivityLogService;

  constructor(private readonly db: PrismaClient) {
    this.activityLogService = new ActivityLogService(db);
  }

  async listCalendar(filters: CalendarFilters) {
    const dateFilter = filters.date ? toDateOnly(filters.date) : undefined;

    const [calendarEvents, schedules, reservations] = await Promise.all([
      this.db.calendarEvent.findMany({
        where: {
          ...(filters.laboratoryId ? { laboratoryId: filters.laboratoryId } : {}),
          ...(dateFilter ? { date: dateFilter } : {})
        },
        include: {
          laboratory: true,
          pc: true
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }]
      }),
      this.db.schedule.findMany({
        where: {
          ...(filters.laboratoryId ? { laboratoryId: filters.laboratoryId } : {}),
          ...(dateFilter ? { date: dateFilter } : {})
        },
        include: {
          laboratory: true
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }]
      }),
      this.db.reservation.findMany({
        where: {
          ...(filters.laboratoryId ? { laboratoryId: filters.laboratoryId } : {}),
          ...(dateFilter ? { reservationDate: dateFilter } : {})
        },
        include: {
          laboratory: true,
          pc: true,
          student: {
            select: {
              firstName: true,
              lastName: true
            }
          }
        },
        orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }]
      })
    ]);

    return {
      customEvents: calendarEvents.map((event) => ({
        id: event.id,
        source: "CALENDAR_EVENT" as const,
        editable: true,
        title: event.title,
        type: event.type,
        date: event.date,
        startTime: event.startTime,
        endTime: event.endTime,
        description: event.description,
        laboratory: event.laboratory,
        pc: event.pc
      })),
      derivedEvents: [
        ...schedules.map((schedule) => ({
          id: schedule.id,
          source: "SCHEDULE" as const,
          editable: false,
          title: `${schedule.laboratory.roomCode} schedule`,
          type: schedule.status,
          date: schedule.date,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          description: `${schedule.laboratory.name} schedule block`,
          laboratory: schedule.laboratory,
          pc: null
        })),
        ...reservations.map((reservation) => ({
          id: reservation.id,
          source: "RESERVATION" as const,
          editable: false,
          title:
            reservation.reservationType === "PC" && reservation.pc
              ? `${reservation.pc.pcNumber} reservation`
              : `${reservation.laboratory.roomCode} reservation`,
          type: reservation.status,
          date: reservation.reservationDate,
          startTime: reservation.startTime,
          endTime: reservation.endTime,
          description: `${reservation.student.firstName} ${reservation.student.lastName} - ${reservation.purpose}`,
          laboratory: reservation.laboratory,
          pc: reservation.pc
        }))
      ]
    };
  }

  async createCalendarEvent(input: CalendarEventInput, actorId: number) {
    await this.ensureCalendarTargets(input.laboratoryId, input.pcId);

    const event = await this.db.calendarEvent.create({
      data: {
        title: input.title,
        type: input.type,
        laboratoryId: input.laboratoryId ?? null,
        pcId: input.pcId ?? null,
        date: toDateOnly(input.date),
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        description: input.description ?? null,
        createdById: actorId
      },
      include: {
        laboratory: true,
        pc: true
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: event.laboratoryId,
      pcId: event.pcId,
      action: "CREATE_CALENDAR_EVENT",
      entityType: "CALENDAR_EVENT",
      entityId: event.id,
      description: `Created ${event.type.toLowerCase()} calendar event ${event.title}.`
    });

    return event;
  }

  async updateCalendarEvent(eventId: number, input: CalendarEventInput, actorId: number) {
    const existingEvent = await this.db.calendarEvent.findUnique({
      where: {
        id: eventId
      }
    });

    if (!existingEvent) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Calendar event not found.");
    }

    await this.ensureCalendarTargets(input.laboratoryId, input.pcId);

    const event = await this.db.calendarEvent.update({
      where: {
        id: eventId
      },
      data: {
        title: input.title,
        type: input.type,
        laboratoryId: input.laboratoryId ?? null,
        pcId: input.pcId ?? null,
        date: toDateOnly(input.date),
        startTime: input.startTime ?? null,
        endTime: input.endTime ?? null,
        description: input.description ?? null
      },
      include: {
        laboratory: true,
        pc: true
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: event.laboratoryId,
      pcId: event.pcId,
      action: "UPDATE_CALENDAR_EVENT",
      entityType: "CALENDAR_EVENT",
      entityId: event.id,
      description: `Updated calendar event ${event.title}.`
    });

    return event;
  }

  async deleteCalendarEvent(eventId: number, actorId: number) {
    const event = await this.db.calendarEvent.findUnique({
      where: {
        id: eventId
      }
    });

    if (!event) {
      throw new ApiError(StatusCodes.NOT_FOUND, "Calendar event not found.");
    }

    await this.db.calendarEvent.delete({
      where: {
        id: eventId
      }
    });

    await this.activityLogService.logActivity({
      userId: actorId,
      labId: event.laboratoryId,
      pcId: event.pcId,
      action: "DELETE_CALENDAR_EVENT",
      entityType: "CALENDAR_EVENT",
      entityId: event.id,
      description: `Deleted calendar event ${event.title}.`
    });
  }

  private async ensureCalendarTargets(laboratoryId?: number | null, pcId?: number | null) {
    if (pcId) {
      const pc = await this.db.pC.findUnique({
        where: {
          id: pcId
        }
      });

      if (!pc) {
        throw new ApiError(StatusCodes.BAD_REQUEST, "The selected PC does not exist.");
      }

      if (laboratoryId && pc.laboratoryId !== laboratoryId) {
        throw new ApiError(
          StatusCodes.BAD_REQUEST,
          "The selected PC does not belong to the selected laboratory."
        );
      }
    }
  }
}
