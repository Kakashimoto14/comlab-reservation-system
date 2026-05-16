import type { PrismaClient, ReservationStatus } from "@prisma/client";

import { env } from "../config/env.js";
import { ContextManager } from "./assistant/ContextManager.js";
import { DateRangeParser } from "./assistant/DateRangeParser.js";
import { IntentDetector } from "./assistant/IntentDetector.js";
import { ResponseFormatter } from "./assistant/ResponseFormatter.js";
import { ScheduleLookupService } from "./assistant/ScheduleLookupService.js";
import type {
  AssistantQuerySnapshot,
  CurrentUser,
  CurrentUserContextResult,
  ReservationAssistantResponse
} from "./assistant/types.js";

const contextManager = new ContextManager();
const MAX_AI_HISTORY_MESSAGES = 16;
const COMPORT_ASSISTANT_SYSTEM_PROMPT = `You are ComPort Assistant, the friendly AI assistant for the ComPort / ComLab Reservation System. You answer questions using the provided authenticated user context, reservation records, laboratory records, schedule and availability records, notification records, activity records, and approved system information. Answer in the same language as the user. If the user uses Tagalog, answer in Tagalog. If the user uses English, answer in English. If the user mixes Tagalog and English, answer in natural Taglish. Never invent database facts. If the provided context does not contain the answer, say that you cannot confirm it from the system records yet. Respect user roles and permissions. Students can only access their own records. Staff and admins can access broader reservation and management data only when the provided context shows they are allowed. Do not reveal passwords, hashes, tokens, secrets, reset data, verification data, or any unrelated private information. Keep answers concise, warm, and clear. Never output JSON, code fences, or internal notes.`;

type BuiltAssistantResponse = {
  response: Omit<ReservationAssistantResponse, "mode">;
  aiContext: string;
};

export class ReservationAssistantService {
  private readonly lookupService: ScheduleLookupService;
  private readonly intentDetector: IntentDetector;
  private readonly responseFormatter = new ResponseFormatter();

  constructor(private readonly db: PrismaClient) {
    this.lookupService = new ScheduleLookupService(db);
    this.intentDetector = new IntentDetector(new DateRangeParser());
  }

  async askReservationAssistant(
    currentUser: CurrentUser,
    message: string
  ): Promise<ReservationAssistantResponse> {
    const context = contextManager.get(currentUser.id, currentUser.sessionId);
    const laboratories = await this.lookupService.listLaboratories();
    const intent = this.intentDetector.detect(message, laboratories, context);

    contextManager.appendUserMessage(
      currentUser.id,
      currentUser.sessionId,
      intent.language,
      message
    );

    const authenticatedUserContext = await this.lookupService.getCurrentUserContext(currentUser);
    const builtResponse = await this.buildBaseResponse(
      currentUser,
      intent,
      authenticatedUserContext
    );

    if (intent.category === "out_of_scope") {
      contextManager.appendAssistantMessage(
        currentUser.id,
        currentUser.sessionId,
        builtResponse.response.reply,
        builtResponse.response.category,
        builtResponse.response.category === "out_of_scope" ? intent.previousQuery : null
      );

      return {
        ...builtResponse.response,
        mode: "fallback"
      };
    }

    const currentContext = contextManager.get(currentUser.id, currentUser.sessionId);
    const aiReply = await this.generateAiReply({
      userMessage: message,
      verifiedReply: builtResponse.response.reply,
      verifiedContext: builtResponse.aiContext,
      authenticatedUserContext,
      language: intent.language,
      conversationHistory: currentContext?.messages ?? [],
      intent: intent.category,
      role: currentUser.role
    });
    const finalResponse = {
      ...builtResponse.response,
      reply: aiReply ?? builtResponse.response.reply,
      mode: aiReply ? ("ai" as const) : ("fallback" as const)
    };

    contextManager.appendAssistantMessage(
      currentUser.id,
      currentUser.sessionId,
      finalResponse.reply,
      finalResponse.category,
      this.buildNextQuerySnapshot(intent, finalResponse.presentation)
    );

    return finalResponse;
  }

  private async buildBaseResponse(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    authenticatedUserContext: CurrentUserContextResult | null
  ): Promise<BuiltAssistantResponse> {
    if (intent.category === "out_of_scope") {
      const response = this.responseFormatter.formatOutOfScope(intent.language);
      return {
        response,
        aiContext: "Assistant scope: ComPort reservation, laboratory, notification, and system-record questions only."
      };
    }

    if (intent.category === "current_user") {
      if (!authenticatedUserContext) {
        return {
          response: {
            category: "current_user",
            reply: this.cannotConfirmUserReply(intent.language),
            suggestions: this.defaultSuggestions(intent.language)
          },
          aiContext: "Authenticated user context could not be loaded from the database."
        };
      }

      const response = this.responseFormatter.formatCurrentUser(
        intent.language,
        authenticatedUserContext
      );
      return {
        response,
        aiContext: JSON.stringify(
          {
            authenticatedUser: authenticatedUserContext
          },
          null,
          2
        )
      };
    }

    if (intent.category === "general_reservation_help") {
      const helpContext = await this.lookupService.getGeneralHelpContext(intent.range);
      const response = this.responseFormatter.formatGeneralHelp(intent.language, helpContext);
      return {
        response,
        aiContext: JSON.stringify(helpContext, null, 2)
      };
    }

    if (intent.category === "system_info") {
      const systemInfo = await this.lookupService.getSystemInfo();
      const response = this.responseFormatter.formatSystemInfo(intent.language, systemInfo);
      return {
        response,
        aiContext: JSON.stringify(systemInfo, null, 2)
      };
    }

    if (intent.category === "reservation_rules") {
      const rules = await this.lookupService.getRules();
      const response = this.responseFormatter.formatRules(intent.language, rules);
      return {
        response,
        aiContext: JSON.stringify({ reservationRules: rules }, null, 2)
      };
    }

    if (intent.category === "notifications") {
      const notifications = await this.lookupService.getNotificationsContext(currentUser, {
        limit: 5
      });
      const response = this.responseFormatter.formatNotifications(intent.language, notifications);
      return {
        response,
        aiContext: JSON.stringify({ notifications }, null, 2)
      };
    }

    if (intent.category === "my_reservations") {
      const statuses = this.extractStatusFilters(intent.normalizedMessage);
      const latestOnly = this.isLatestReservationQuestion(intent.normalizedMessage);
      const upcomingOnly = this.isUpcomingReservationQuestion(intent.normalizedMessage);
      const reservationContext = await this.lookupService.getUserReservations(
        currentUser,
        intent.range,
        {
          latestOnly,
          upcomingOnly,
          statuses,
          orderBy: latestOnly ? "desc" : "asc",
          take: latestOnly ? 1 : 12
        }
      );
      const response = this.responseFormatter.formatReservations(
        intent.language,
        reservationContext,
        intent.range,
        intent.normalizedMessage
      );
      return {
        response,
        aiContext: JSON.stringify(
          {
            reservationRange: intent.range.label,
            latestOnly,
            upcomingOnly,
            statuses,
            reservations: reservationContext.reservations
          },
          null,
          2
        )
      };
    }

    if (intent.category === "admin_stats") {
      const stats = await this.lookupService.getSystemStatsForRole(currentUser);

      if (!stats) {
        const response = this.responseFormatter.formatPermissionDenied(intent.language, "admin");
        return {
          response,
          aiContext: `Access denied. Current role ${currentUser.role} cannot view whole-system reservation stats.`
        };
      }

      const response = this.responseFormatter.formatAdminStats(intent.language, stats);
      return {
        response,
        aiContext: JSON.stringify({ systemStats: stats }, null, 2)
      };
    }

    if (intent.category === "approval_queue") {
      const queue = await this.lookupService.getApprovalQueue(currentUser, { limit: 8 });

      if (!queue) {
        const response = this.responseFormatter.formatPermissionDenied(intent.language, "admin");
        return {
          response,
          aiContext: `Access denied. Current role ${currentUser.role} cannot view reservation approval queues.`
        };
      }

      const response = this.responseFormatter.formatApprovalQueue(intent.language, queue);
      return {
        response,
        aiContext: JSON.stringify({ approvalQueue: queue.reservations }, null, 2)
      };
    }

    if (intent.category === "reservation_submitter") {
      if (currentUser.role === "STUDENT") {
        const response = this.responseFormatter.formatPermissionDenied(
          intent.language,
          "reservation_submitter"
        );
        return {
          response,
          aiContext: `Access denied. Current role ${currentUser.role} cannot view reservation submitter details.`
        };
      }

      const reservationCode = this.extractReservationCode(intent.normalizedMessage);
      const asksLatest = /latest|pinakabago|huli/.test(intent.normalizedMessage);

      if (!reservationCode && !asksLatest) {
        return {
          response: {
            category: "reservation_submitter",
            reply: this.pick(intent.language, {
              english:
                "I can confirm that for staff or admin workflows, but I need a reservation code or a question about the latest reservation.",
              tagalog:
                "Maiko-confirm ko iyon para sa staff o admin workflows, pero kailangan ko ng reservation code o tanong tungkol sa latest reservation.",
              taglish:
                "Ma-confirm ko iyon for staff or admin workflows, pero kailangan ko ng reservation code or tanong tungkol sa latest reservation."
            }),
            suggestions: this.pick(intent.language, {
              english: [
                "Who submitted the latest reservation?",
                "Which reservations need approval?"
              ],
              tagalog: [
                "Sino ang nagsumite ng latest reservation?",
                "Aling reservations ang kailangang i-approve?"
              ],
              taglish: [
                "Who submitted the latest reservation?",
                "Show reservations needing approval."
              ]
            })
          },
          aiContext: "Reservation submitter lookup needs either an explicit reservation code or the latest-reservation scope."
        };
      }

      const reservation = await this.lookupService.getReservationSubmitter(currentUser, {
        latest: asksLatest || !reservationCode,
        reservationCode: reservationCode ?? undefined
      });

      if (!reservation) {
        return {
          response: {
            category: "reservation_submitter",
            reply: this.pick(intent.language, {
              english: "I couldn't confirm that reservation submitter from the visible system records yet.",
              tagalog:
                "Hindi ko pa mako-confirm ang gumawa ng reservation na iyon mula sa visible system records.",
              taglish:
                "Hindi ko pa ma-confirm ang gumawa ng reservation na iyon from the visible system records."
            }),
            suggestions: this.pick(intent.language, {
              english: [
                "Who submitted the latest reservation?",
                "Which reservations need approval?"
              ],
              tagalog: [
                "Sino ang nagsumite ng latest reservation?",
                "Aling reservations ang kailangang i-approve?"
              ],
              taglish: [
                "Who submitted the latest reservation?",
                "Show reservations needing approval."
              ]
            })
          },
          aiContext: "No reservation submitter was found within the user's visible management scope."
        };
      }

      const response = this.responseFormatter.formatReservationSubmitter(
        intent.language,
        reservation
      );
      return {
        response,
        aiContext: JSON.stringify({ reservationSubmitter: reservation }, null, 2)
      };
    }

    if (intent.category === "recent_activity") {
      const activity = await this.lookupService.getRecentActivity(currentUser, { limit: 8 });

      if (!activity) {
        const response = this.responseFormatter.formatPermissionDenied(intent.language, "activity");
        return {
          response,
          aiContext: `Access denied. Current role ${currentUser.role} cannot view recent activity logs.`
        };
      }

      const response = this.responseFormatter.formatRecentActivity(intent.language, activity);
      return {
        response,
        aiContext: JSON.stringify({ recentActivity: activity.activities }, null, 2)
      };
    }

    if (intent.category === "user_directory") {
      const directory = await this.lookupService.getStaffDirectory(currentUser, { limit: 12 });

      if (!directory) {
        const response = this.responseFormatter.formatPermissionDenied(intent.language, "directory");
        return {
          response,
          aiContext: `Access denied. Current role ${currentUser.role} cannot view staff or admin directory data.`
        };
      }

      const response = this.responseFormatter.formatStaffDirectory(intent.language, directory);
      return {
        response,
        aiContext: JSON.stringify({ visibleDirectory: directory.users }, null, 2)
      };
    }

    if (intent.category === "laboratory_lookup" && intent.laboratory) {
      const laboratoryContext = await this.lookupService.getLaboratoryLookup(intent.laboratory);
      const response = this.responseFormatter.formatLaboratoryLookup(
        intent.language,
        laboratoryContext
      );
      return {
        response,
        aiContext: JSON.stringify({ laboratory: laboratoryContext.laboratory }, null, 2)
      };
    }

    if (intent.category === "specific_laboratory") {
      if (!intent.laboratory) {
        const suggestions = await this.lookupService.getLaboratorySuggestions();
        const response = this.responseFormatter.formatUnmatchedLaboratory(
          intent.language,
          suggestions
        );
        return {
          response,
          aiContext: "The user asked about a laboratory, but no exact laboratory could be matched from current records."
        };
      }

      const offset = intent.isShowMore ? intent.previousQuery?.resultOffset ?? 0 : 0;
      const scheduleContext = await this.lookupService.getScheduleAvailability(intent.range, {
        laboratoryId: intent.laboratory.id,
        offset
      });
      const response = this.responseFormatter.formatSpecificLaboratory(
        intent.language,
        intent.laboratory,
        scheduleContext
      );

      return {
        response,
        aiContext: JSON.stringify(
          {
            laboratory: intent.laboratory,
            range: intent.range.label,
            schedules: scheduleContext.schedules,
            totalCount: scheduleContext.totalCount,
            calendarNotes: scheduleContext.calendarNotes
          },
          null,
          2
        )
      };
    }

    if (intent.category === "available_laboratories") {
      const offset = intent.isShowMore ? intent.previousQuery?.resultOffset ?? 0 : 0;
      const laboratoryContext = await this.lookupService.getLaboratoryAvailability(intent.range, {
        offset
      });
      const response = this.responseFormatter.formatLaboratoryAvailability(
        intent.language,
        laboratoryContext
      );
      return {
        response,
        aiContext: JSON.stringify(
          {
            range: intent.range.label,
            laboratories: laboratoryContext.laboratories,
            totalCount: laboratoryContext.totalCount,
            calendarNotes: laboratoryContext.calendarNotes
          },
          null,
          2
        )
      };
    }

    const offset = intent.isShowMore ? intent.previousQuery?.resultOffset ?? 0 : 0;
    const scheduleContext = await this.lookupService.getScheduleAvailability(intent.range, {
      offset
    });
    const response = this.responseFormatter.formatScheduleAvailability(
      intent.language,
      scheduleContext
    );
    return {
      response,
      aiContext: JSON.stringify(
        {
          range: intent.range.label,
          schedules: scheduleContext.schedules,
          totalCount: scheduleContext.totalCount,
          calendarNotes: scheduleContext.calendarNotes
        },
        null,
        2
      )
    };
  }

  private buildNextQuerySnapshot(
    intent: ReturnType<IntentDetector["detect"]>,
    presentation?: ReservationAssistantResponse["presentation"]
  ): AssistantQuerySnapshot | null {
    if (
      [
        "out_of_scope",
        "current_user",
        "notifications",
        "admin_stats",
        "approval_queue",
        "recent_activity",
        "system_info",
        "user_directory",
        "reservation_submitter",
        "reservation_rules",
        "general_reservation_help"
      ].includes(intent.category)
    ) {
      return intent.previousQuery;
    }

    const showingCount =
      presentation?.type === "schedule-results"
        ? presentation.showingCount
        : presentation?.type === "laboratory-results"
          ? presentation.showingCount
          : presentation?.type === "reservation-results"
            ? presentation.reservations.length
            : 0;

    const previousOffset = intent.isShowMore ? intent.previousQuery?.resultOffset ?? 0 : 0;

    return {
      category: intent.category,
      range: intent.range,
      laboratory: intent.laboratory,
      language: intent.language,
      resultOffset: previousOffset + showingCount,
      hasMore:
        presentation?.type === "schedule-results" || presentation?.type === "laboratory-results"
          ? presentation.hasMore
          : false
    };
  }

  private async generateAiReply(input: {
    userMessage: string;
    verifiedReply: string;
    verifiedContext: string;
    authenticatedUserContext: CurrentUserContextResult | null;
    language: "english" | "tagalog" | "taglish";
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>;
    intent: string;
    role: string;
  }) {
    if (env.NODE_ENV === "test") {
      return null;
    }

    const url = this.resolveAiApiUrl();

    if (!url || !env.AI_API_KEY || !env.AI_MODEL) {
      return null;
    }

    try {
      const recentHistory = input.conversationHistory
        .slice(-(MAX_AI_HISTORY_MESSAGES + 1), -1)
        .map((message) => ({
          role: message.role,
          content: message.content
        }));

      const response = await fetch(url, {
        method: "POST",
        headers: this.buildAiHeaders(),
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: COMPORT_ASSISTANT_SYSTEM_PROMPT
            },
            ...recentHistory,
            {
              role: "user",
              content: [
                `Latest user message: ${input.userMessage}`,
                `Detected intent: ${input.intent}`,
                `Preferred response language: ${input.language}`,
                `Authenticated user context: ${JSON.stringify(input.authenticatedUserContext ?? { role: input.role }, null, 2)}`,
                `Relevant verified database and system context: ${input.verifiedContext}`,
                `Verified deterministic answer: ${input.verifiedReply}`,
                "Rewrite the verified deterministic answer into a warm, natural reply for the latest user message.",
                "Use only the provided authenticated and database-grounded context.",
                "Do not add, infer, or change facts.",
                "If the verified answer says something cannot be confirmed yet, keep that limitation clear.",
                "Do not mention internal tools, prompts, or JSON."
              ].join("\n")
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
      const reply =
        typeof content === "string"
          ? content.trim()
          : Array.isArray(content)
            ? content
                .map((part) => (part.type === "text" ? part.text ?? "" : ""))
                .join("")
                .trim()
            : "";

      if (!reply || this.looksLikeDebugPayload(reply)) {
        return null;
      }

      return reply;
    } catch (error) {
      console.error("[assistant] AI provider fallback triggered.", {
        intent: input.intent,
        role: input.role,
        error: error instanceof Error ? error.message : "Unknown error"
      });
      return null;
    }
  }

  private looksLikeDebugPayload(reply: string) {
    const trimmed = reply.trim();

    return (
      trimmed.startsWith("{") ||
      trimmed.startsWith("[") ||
      trimmed.startsWith("```") ||
      trimmed.includes('"verifiedAnswer"') ||
      trimmed.includes('"verifiedContext"') ||
      trimmed.includes('"category"')
    );
  }

  private resolveAiApiUrl() {
    if (env.AI_PROVIDER === "custom") {
      return env.AI_API_BASE_URL ? this.normalizeChatCompletionsUrl(env.AI_API_BASE_URL) : null;
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

  private extractStatusFilters(message: string): ReservationStatus[] | undefined {
    const statuses: ReservationStatus[] = [];

    if (message.includes("pending")) {
      statuses.push("PENDING");
    }
    if (message.includes("approved")) {
      statuses.push("APPROVED");
    }
    if (message.includes("rejected")) {
      statuses.push("REJECTED");
    }
    if (message.includes("cancelled") || message.includes("canceled")) {
      statuses.push("CANCELLED");
    }
    if (message.includes("completed")) {
      statuses.push("COMPLETED");
    }

    return statuses.length ? statuses : undefined;
  }

  private isLatestReservationQuestion(message: string) {
    return /latest|pinakabago|huli/.test(message);
  }

  private isUpcomingReservationQuestion(message: string) {
    return /upcoming|susunod/.test(message);
  }

  private extractReservationCode(message: string) {
    const match = message.match(/\b(?:rsv-\d{4}-\d{4}|pending-[a-z0-9-]+)\b/i);
    return match?.[0]?.toUpperCase() ?? null;
  }

  private cannotConfirmUserReply(language: "english" | "tagalog" | "taglish") {
    return this.pick(language, {
      english: "I couldn't confirm your account details from the current system records yet.",
      tagalog: "Hindi ko pa mako-confirm ang account details mo mula sa current system records.",
      taglish: "Hindi ko pa ma-confirm ang account details mo from the current system records."
    });
  }

  private defaultSuggestions(language: "english" | "tagalog" | "taglish") {
    return this.pick(language, {
      english: [
        "Who am I?",
        "What are my reservations today?",
        "What notifications do I have?"
      ],
      tagalog: [
        "Sino ako?",
        "Ano ang reservations ko ngayong araw?",
        "Ano ang notifications ko?"
      ],
      taglish: ["Who am I?", "Ano reservation ko ngayon?", "Ano notifications ko?"]
    });
  }

  private pick<T>(
    language: "english" | "tagalog" | "taglish",
    value: { english: T; tagalog: T; taglish: T }
  ) {
    if (language === "tagalog") {
      return value.tagalog;
    }

    if (language === "taglish") {
      return value.taglish;
    }

    return value.english;
  }
}
