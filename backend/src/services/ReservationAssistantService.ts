import type {
  LaboratoryStatus,
  PrismaClient,
  ReservationStatus,
  UserRole
} from "@prisma/client";

import { env } from "../config/env.js";
import { toDateOnly } from "../utils/time.js";

type CurrentUser = {
  id: number;
  role: UserRole;
};

type AssistantCategory =
  | "available_schedules"
  | "available_laboratories"
  | "specific_laboratory"
  | "my_upcoming_reservations"
  | "reservation_rules"
  | "general_reservation_help"
  | "out_of_scope";

type ReservationAssistantResponse = {
  reply: string;
  mode: "ai" | "fallback";
  category: AssistantCategory;
};

type TimeWindow = {
  startTime: string;
  endTime: string;
};

type DateRange = {
  start: Date;
  end: Date;
  label: string;
};

type LaboratorySummary = {
  id: number;
  name: string;
  roomCode: string;
  building: string;
  status: LaboratoryStatus;
};

type ScheduleAvailability = {
  laboratoryId: number;
  laboratoryName: string;
  roomCode: string;
  building: string;
  date: string;
  scheduleWindow: string;
  freeWindows: TimeWindow[];
};

type CalendarNote = {
  date: string;
  title: string;
  type: string;
  laboratory?: string | null;
  timeWindow?: string | null;
};

type ReservationRule = {
  title: string;
  detail: string;
};

type Intent =
  | {
      category: "available_schedules" | "available_laboratories" | "general_reservation_help";
      range: DateRange;
      laboratory: LaboratorySummary | null;
    }
  | {
      category: "specific_laboratory";
      range: DateRange;
      laboratory: LaboratorySummary | null;
    }
  | {
      category: "my_upcoming_reservations";
      range: DateRange;
    }
  | {
      category: "reservation_rules";
      range: DateRange;
    }
  | {
      category: "out_of_scope";
      range: DateRange;
    };

const ACTIVE_AVAILABILITY_STATUSES: ReservationStatus[] = [
  "PENDING",
  "APPROVED",
  "COMPLETED"
];

const MIN_OPEN_WINDOW_MINUTES = 30;
const RULES: ReservationRule[] = [
  {
    title: "Published schedule blocks only",
    detail: "Reservations must stay inside a schedule with AVAILABLE status for the selected laboratory."
  },
  {
    title: "Valid time range",
    detail: "The reservation end time must be later than the start time."
  },
  {
    title: "Whole-lab conflicts",
    detail: "A whole-laboratory reservation cannot overlap any active reservation in the same laboratory and date."
  },
  {
    title: "PC conflicts",
    detail: "A PC reservation requires an AVAILABLE PC and cannot overlap the same PC or a whole-laboratory booking."
  },
  {
    title: "Pending review flow",
    detail: "Student reservations are submitted as pending and are reviewed by administrators or assigned laboratory staff."
  },
  {
    title: "Student cancellation",
    detail: "Students can cancel only their own pending reservations."
  }
];

export class ReservationAssistantService {
  constructor(private readonly db: PrismaClient) {}

  async askReservationAssistant(
    currentUser: CurrentUser,
    message: string
  ): Promise<ReservationAssistantResponse> {
    const intent = await this.resolveIntent(message);

    if (intent.category === "out_of_scope") {
      return {
        reply: "I can only help with ComLab reservation-related questions.",
        mode: "fallback",
        category: intent.category
      };
    }

    const context = await this.buildContext(currentUser, intent);
    const fallbackReply = this.buildFallbackReply(intent, context);
    const aiReply = await this.generateAiReply(message, intent.category, context, fallbackReply);

    return {
      reply: aiReply ?? fallbackReply,
      mode: aiReply ? "ai" : "fallback",
      category: intent.category
    };
  }

  private async resolveIntent(message: string): Promise<Intent> {
    const normalizedMessage = this.normalizeForSearch(message);
    const range = this.resolveDateRange(normalizedMessage);

    if (this.isGreeting(normalizedMessage)) {
      return {
        category: "general_reservation_help",
        range,
        laboratory: null
      };
    }

    if (!this.isReservationRelated(normalizedMessage)) {
      return {
        category: "out_of_scope",
        range
      };
    }

    if (
      normalizedMessage.includes("my upcoming reservation") ||
      normalizedMessage.includes("my reservations") ||
      normalizedMessage.includes("upcoming reservations")
    ) {
      return {
        category: "my_upcoming_reservations",
        range
      };
    }

    if (
      normalizedMessage.includes("rule") ||
      normalizedMessage.includes("policy") ||
      normalizedMessage.includes("how can i reserve") ||
      normalizedMessage.includes("how do i reserve") ||
      normalizedMessage.includes("when can i reserve")
    ) {
      return {
        category: "reservation_rules",
        range
      };
    }

    const laboratories = await this.db.laboratory.findMany({
      select: {
        id: true,
        name: true,
        roomCode: true,
        building: true,
        status: true
      },
      orderBy: [{ building: "asc" }, { roomCode: "asc" }]
    });
    const matchedLaboratory = this.matchLaboratory(normalizedMessage, laboratories);

    if (
      matchedLaboratory ||
      /\bcl[- ]?\d{3}\b/.test(normalizedMessage) ||
      /\b(?:is|for|in)\s+lab(?:oratory)?\b/.test(normalizedMessage)
    ) {
      return {
        category: "specific_laboratory",
        range,
        laboratory: matchedLaboratory
      };
    }

    if (
      normalizedMessage.includes("time slot") ||
      normalizedMessage.includes("time slots") ||
      normalizedMessage.includes("open slot") ||
      normalizedMessage.includes("open time")
    ) {
      return {
        category: "available_schedules",
        range,
        laboratory: null
      };
    }

    if (normalizedMessage.includes("schedule")) {
      return {
        category: "available_schedules",
        range,
        laboratory: null
      };
    }

    if (
      normalizedMessage.includes("available") ||
      normalizedMessage.includes("open") ||
      normalizedMessage.includes("free")
    ) {
      return {
        category: "available_laboratories",
        range,
        laboratory: null
      };
    }

    return {
      category: "general_reservation_help",
      range,
      laboratory: null
    };
  }

  private async buildContext(currentUser: CurrentUser, intent: Intent) {
    switch (intent.category) {
      case "my_upcoming_reservations":
        return this.buildUpcomingReservationsContext(currentUser, intent.range);
      case "reservation_rules":
        return this.buildRulesContext(intent.range);
      case "available_laboratories":
        return this.buildLaboratoryAvailabilityContext(intent.range);
      case "available_schedules":
        return this.buildScheduleAvailabilityContext(intent.range);
      case "specific_laboratory":
        return this.buildSpecificLaboratoryContext(intent.range, intent.laboratory);
      case "general_reservation_help":
        return this.buildGeneralHelpContext(intent.range);
      default:
        return {
          category: "out_of_scope" as const
        };
    }
  }

  private async buildUpcomingReservationsContext(currentUser: CurrentUser, range: DateRange) {
    const reservations = await this.db.reservation.findMany({
      where: {
        studentId: currentUser.id,
        reservationDate: {
          gte: toDateOnly(new Date()),
          lte: range.end
        },
        status: {
          in: ["PENDING", "APPROVED"]
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
      take: 8
    });

    return {
      category: "my_upcoming_reservations" as const,
      rangeLabel: range.label,
      reservations: reservations.map((reservation) => ({
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

  private buildRulesContext(range: DateRange) {
    return {
      category: "reservation_rules" as const,
      rangeLabel: range.label,
      rules: RULES
    };
  }

  private async buildLaboratoryAvailabilityContext(range: DateRange) {
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

    return {
      category: "available_laboratories" as const,
      rangeLabel: range.label,
      laboratories,
      calendarNotes
    };
  }

  private async buildScheduleAvailabilityContext(range: DateRange) {
    const { schedules, calendarNotes } = await this.loadScheduleAvailability(range);

    return {
      category: "available_schedules" as const,
      rangeLabel: range.label,
      schedules: schedules.filter((schedule) => schedule.freeWindows.length > 0).slice(0, 12),
      calendarNotes
    };
  }

  private async buildSpecificLaboratoryContext(
    range: DateRange,
    laboratory: LaboratorySummary | null
  ) {
    if (!laboratory) {
      const examples = await this.db.laboratory.findMany({
        select: {
          name: true,
          roomCode: true
        },
        orderBy: [{ building: "asc" }, { roomCode: "asc" }],
        take: 3
      });

      return {
        category: "specific_laboratory" as const,
        rangeLabel: range.label,
        laboratory: null,
        schedules: [] as ScheduleAvailability[],
        calendarNotes: [] as CalendarNote[],
        suggestions: examples.map((item) => `${item.name} (${item.roomCode})`)
      };
    }

    const { schedules, calendarNotes } = await this.loadScheduleAvailability(range, laboratory.id);

    return {
      category: "specific_laboratory" as const,
      rangeLabel: range.label,
      laboratory,
      schedules,
      calendarNotes,
      suggestions: [] as string[]
    };
  }

  private async buildGeneralHelpContext(range: DateRange) {
    const [availableLaboratories, schedules] = await Promise.all([
      this.db.laboratory.count({
        where: {
          status: "AVAILABLE"
        }
      }),
      this.db.schedule.count({
        where: {
          status: "AVAILABLE",
          date: {
            gte: range.start,
            lte: range.end
          }
        }
      })
    ]);

    return {
      category: "general_reservation_help" as const,
      rangeLabel: range.label,
      availableLaboratories,
      scheduleCount: schedules,
      supportedQuestions: [
        "What are the available schedules this week?",
        "Which laboratories are available today?",
        "Show my upcoming reservations.",
        "What are the reservation rules?"
      ]
    };
  }

  private async loadScheduleAvailability(range: DateRange, laboratoryId?: number) {
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
            gte: range.start,
            lte: range.end
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
              id: true,
              name: true,
              roomCode: true,
              building: true,
              status: true
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
            gte: range.start,
            lte: range.end
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
          endTime: true,
          reservationType: true
        },
        orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }]
      }),
      this.db.calendarEvent.findMany({
        where: {
          date: {
            gte: range.start,
            lte: range.end
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

  private buildFallbackReply(intent: Intent, context: Awaited<ReturnType<ReservationAssistantService["buildContext"]>>) {
    switch (intent.category) {
      case "my_upcoming_reservations":
        return this.buildUpcomingReservationsReply(context as Awaited<ReturnType<ReservationAssistantService["buildUpcomingReservationsContext"]>>);
      case "reservation_rules":
        return this.buildRulesReply(context as ReturnType<ReservationAssistantService["buildRulesContext"]>);
      case "available_laboratories":
        return this.buildLaboratoryAvailabilityReply(context as Awaited<ReturnType<ReservationAssistantService["buildLaboratoryAvailabilityContext"]>>);
      case "available_schedules":
        return this.buildScheduleAvailabilityReply(context as Awaited<ReturnType<ReservationAssistantService["buildScheduleAvailabilityContext"]>>);
      case "specific_laboratory":
        return this.buildSpecificLaboratoryReply(context as Awaited<ReturnType<ReservationAssistantService["buildSpecificLaboratoryContext"]>>);
      case "general_reservation_help":
        return this.buildGeneralHelpReply(context as Awaited<ReturnType<ReservationAssistantService["buildGeneralHelpContext"]>>);
      default:
        return "I can only help with ComLab reservation-related questions.";
    }
  }

  private buildUpcomingReservationsReply(
    context: Awaited<ReturnType<ReservationAssistantService["buildUpcomingReservationsContext"]>>
  ) {
    if (!context.reservations.length) {
      return `You do not have any pending or approved upcoming reservations in ${context.rangeLabel}.`;
    }

    const lines = [
      `Here are your upcoming reservations in ${context.rangeLabel}:`
    ];

    for (const reservation of context.reservations) {
      lines.push(
        `- ${reservation.date} ${reservation.startTime}-${reservation.endTime}: ${reservation.laboratoryName} (${reservation.roomCode}) [${reservation.status}]`
      );
    }

    return lines.join("\n");
  }

  private buildRulesReply(
    context: ReturnType<ReservationAssistantService["buildRulesContext"]>
  ) {
    const lines = ["These are the current reservation rules I can confirm from the system:"];

    for (const rule of context.rules) {
      lines.push(`- ${rule.title}: ${rule.detail}`);
    }

    return lines.join("\n");
  }

  private buildLaboratoryAvailabilityReply(
    context: Awaited<ReturnType<ReservationAssistantService["buildLaboratoryAvailabilityContext"]>>
  ) {
    if (!context.laboratories.length) {
      return `I could not find any laboratories with open published schedule windows in ${context.rangeLabel}.`;
    }

    const lines = [
      `These laboratories still have open published schedule windows in ${context.rangeLabel}:`
    ];

    for (const laboratory of context.laboratories) {
      const windows = laboratory.nextOpenWindows
        .map((window) => `${window.date} ${window.startTime}-${window.endTime}`)
        .join(", ");
      lines.push(
        `- ${laboratory.laboratoryName} (${laboratory.roomCode}) in ${laboratory.building}: ${windows}`
      );
    }

    if (context.calendarNotes.length) {
      lines.push(
        "",
        "There are also calendar notices in this range, so it is a good idea to double-check the calendar view for maintenance or holiday notes."
      );
    }

    return lines.join("\n");
  }

  private buildScheduleAvailabilityReply(
    context: Awaited<ReturnType<ReservationAssistantService["buildScheduleAvailabilityContext"]>>
  ) {
    if (!context.schedules.length) {
      return `I could not find any open published schedule windows in ${context.rangeLabel}.`;
    }

    const lines = [`These open schedule windows are available in ${context.rangeLabel}:`];

    for (const schedule of context.schedules) {
      const windows = schedule.freeWindows
        .map((window) => `${window.startTime}-${window.endTime}`)
        .join(", ");
      lines.push(
        `- ${schedule.date} | ${schedule.laboratoryName} (${schedule.roomCode}) | published ${schedule.scheduleWindow} | open: ${windows}`
      );
    }

    return lines.join("\n");
  }

  private buildSpecificLaboratoryReply(
    context: Awaited<ReturnType<ReservationAssistantService["buildSpecificLaboratoryContext"]>>
  ) {
    if (!context.laboratory) {
      const suggestions = context.suggestions.length
        ? ` Try one of these exact names or room codes: ${context.suggestions.join(", ")}.`
        : "";

      return `I could not match that laboratory to a current record.${suggestions}`;
    }

    if (context.laboratory.status !== "AVAILABLE") {
      return `${context.laboratory.name} (${context.laboratory.roomCode}) is currently marked as ${context.laboratory.status.toLowerCase()}, so it is not available for reservation right now.`;
    }

    const openSchedules = context.schedules.filter((schedule) => schedule.freeWindows.length > 0);

    if (!openSchedules.length) {
      return `${context.laboratory.name} (${context.laboratory.roomCode}) does not have any open published schedule windows in ${context.rangeLabel}.`;
    }

    const lines = [
      `${context.laboratory.name} (${context.laboratory.roomCode}) has these open windows in ${context.rangeLabel}:`
    ];

    for (const schedule of openSchedules) {
      lines.push(
        `- ${schedule.date} | published ${schedule.scheduleWindow} | open: ${schedule.freeWindows
          .map((window) => `${window.startTime}-${window.endTime}`)
          .join(", ")}`
      );
    }

    if (context.calendarNotes.length) {
      const notes = context.calendarNotes
        .map((note) => `${note.date}: ${note.title}${note.timeWindow ? ` (${note.timeWindow})` : ""}`)
        .join("; ");
      lines.push("", `Calendar notes in this range: ${notes}`);
    }

    return lines.join("\n");
  }

  private buildGeneralHelpReply(
    context: Awaited<ReturnType<ReservationAssistantService["buildGeneralHelpContext"]>>
  ) {
    return [
      `Hi! I can help with ComPort reservation questions. Right now the system has ${context.availableLaboratories} laboratories marked as available and ${context.scheduleCount} published AVAILABLE schedule blocks in ${context.rangeLabel}.`,
      "",
      "Try one of these:",
      ...context.supportedQuestions.map((question) => `- ${question}`)
    ].join("\n");
  }

  private async generateAiReply(
    userMessage: string,
    category: AssistantCategory,
    context: Awaited<ReturnType<ReservationAssistantService["buildContext"]>>,
    fallbackReply: string
  ) {
    const url = this.resolveAiApiUrl();

    if (!url || !env.AI_API_KEY || !env.AI_MODEL) {
      return null;
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.buildAiHeaders(),
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are ComPort/ComLab Reservation Assistant. Answer only using the provided system context. Do not invent labs, schedules, reservations, policies, or user data. If the context is insufficient, say what information is missing. Keep answers concise and helpful. If the question is outside ComLab reservations, respond exactly with: I can only help with ComLab reservation-related questions."
            },
            {
              role: "user",
              content: JSON.stringify(
                {
                  category,
                  question: userMessage,
                  verifiedContext: context,
                  verifiedDraftAnswer: fallbackReply
                },
                null,
                2
              )
            }
          ]
        }),
        signal: AbortSignal.timeout(15_000)
      });

      if (!response.ok) {
        throw new Error(`Assistant provider request failed with status ${response.status}.`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string | Array<{ type?: string; text?: string }>;
          };
        }>;
      };
      const content = data.choices?.[0]?.message?.content;

      if (typeof content === "string" && content.trim()) {
        return content.trim();
      }

      if (Array.isArray(content)) {
        const combined = content
          .map((part) => (part.type === "text" ? part.text ?? "" : ""))
          .join("")
          .trim();

        return combined || null;
      }

      return null;
    } catch (error) {
      console.error("[assistant] Falling back to deterministic reply.", error);
      return null;
    }
  }

  private resolveAiApiUrl() {
    if (env.AI_PROVIDER === "custom") {
      return env.AI_API_BASE_URL
        ? this.normalizeChatCompletionsUrl(env.AI_API_BASE_URL)
        : null;
    }

    if (env.AI_API_BASE_URL) {
      return this.normalizeChatCompletionsUrl(env.AI_API_BASE_URL);
    }

    switch (env.AI_PROVIDER) {
      case "openai":
        return "https://api.openai.com/v1/chat/completions";
      case "groq":
        return "https://api.groq.com/openai/v1/chat/completions";
      case "openrouter":
        return "https://openrouter.ai/api/v1/chat/completions";
      default:
        return null;
    }
  }

  private buildAiHeaders() {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${env.AI_API_KEY}`,
      "Content-Type": "application/json"
    };
    const apiUrl = this.resolveAiApiUrl();
    const isOpenRouter =
      env.AI_PROVIDER === "openrouter" || apiUrl?.includes("openrouter.ai");

    if (isOpenRouter) {
      const siteUrl = env.OPENROUTER_SITE_URL ?? env.FRONTEND_URL;
      const appName = env.OPENROUTER_APP_NAME;

      if (siteUrl) {
        headers["HTTP-Referer"] = siteUrl;
      }

      if (appName) {
        headers["X-Title"] = appName;
        headers["X-OpenRouter-Title"] = appName;
      }
    }

    return headers;
  }

  private normalizeChatCompletionsUrl(value: string) {
    return value.endsWith("/chat/completions")
      ? value
      : `${value.replace(/\/$/, "")}/chat/completions`;
  }

  private normalizeForSearch(value: string) {
    return value.toLowerCase().replace(/\s+/g, " ").trim();
  }

  private isGreeting(message: string) {
    return /^(hi|hello|hey|good morning|good afternoon|good evening)(!|\.)?$/.test(message);
  }

  private isReservationRelated(message: string) {
    return [
      "reservation",
      "reserve",
      "schedule",
      "laboratory",
      "lab",
      "computer lab",
      "pc",
      "availability",
      "available",
      "open",
      "slot",
      "time slot",
      "rule",
      "policy",
      "room"
    ].some((keyword) => message.includes(keyword));
  }

  private resolveDateRange(message: string): DateRange {
    const today = toDateOnly(new Date());

    if (message.includes("tomorrow")) {
      const tomorrow = this.addDays(today, 1);
      return {
        start: tomorrow,
        end: tomorrow,
        label: "tomorrow"
      };
    }

    if (message.includes("today")) {
      return {
        start: today,
        end: today,
        label: "today"
      };
    }

    const explicitIsoDate = message.match(/\b\d{4}-\d{2}-\d{2}\b/);

    if (explicitIsoDate) {
      const parsedDate = toDateOnly(explicitIsoDate[0]);
      return {
        start: parsedDate,
        end: parsedDate,
        label: explicitIsoDate[0]
      };
    }

    if (message.includes("this week")) {
      const weekStart = this.startOfIsoWeek(today);
      return {
        start: weekStart,
        end: this.addDays(weekStart, 6),
        label: "this week"
      };
    }

    return {
      start: today,
      end: this.addDays(today, 6),
      label: "the next 7 days"
    };
  }

  private matchLaboratory(message: string, laboratories: LaboratorySummary[]) {
    const normalizedMessage = this.normalizeForSearch(message);
    const numberedLaboratoryMatch = normalizedMessage.match(
      /\b(?:laboratory|lab)\s+(\d{1,2})\b/
    );

    if (numberedLaboratoryMatch) {
      const index = Number.parseInt(numberedLaboratoryMatch[1], 10) - 1;

      if (index >= 0 && index < laboratories.length) {
        return laboratories[index];
      }
    }

    return (
      laboratories.find((laboratory) => {
        const roomCode = laboratory.roomCode.toLowerCase();
        const normalizedRoomCode = roomCode.replace(/\s+/g, "");
        const normalizedName = this.normalizeForSearch(laboratory.name);

        return (
          normalizedMessage.includes(roomCode) ||
          normalizedMessage.includes(normalizedRoomCode) ||
          normalizedMessage.includes(normalizedName)
        );
      }) ?? null
    );
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
    return date.toISOString().slice(0, 10);
  }

  private addDays(date: Date, days: number) {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + days);
    return toDateOnly(nextDate);
  }

  private startOfIsoWeek(date: Date) {
    const baseDate = toDateOnly(date);
    const day = baseDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;

    return this.addDays(baseDate, diff);
  }
}
