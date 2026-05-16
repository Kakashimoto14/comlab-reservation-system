import type { PrismaClient } from "@prisma/client";

import { env } from "../config/env.js";
import { ContextManager } from "./assistant/ContextManager.js";
import { DateRangeParser } from "./assistant/DateRangeParser.js";
import { IntentDetector } from "./assistant/IntentDetector.js";
import { ResponseFormatter } from "./assistant/ResponseFormatter.js";
import { ScheduleLookupService } from "./assistant/ScheduleLookupService.js";
import type {
  AssistantQuerySnapshot,
  CurrentUser,
  ReservationAssistantResponse
} from "./assistant/types.js";

const contextManager = new ContextManager();
const MAX_AI_HISTORY_MESSAGES = 10;
const COMPORT_ASSISTANT_SYSTEM_PROMPT = `You are ComPort Assistant, the friendly AI assistant for the ComPort / ComLab Reservation System. You help students, staff, and admins understand laboratory reservations, available schedules, reservation status, rules, and how to use the system. Be warm, clear, and helpful. Answer in the same language the user uses. If the user uses Tagalog, answer in Tagalog. If the user uses English, answer in English. If the user uses Tagalog and English together, answer naturally in Taglish. ComPort is a computer laboratory reservation portal where students can request laboratory schedules and staff or admins can approve, reject, manage, or monitor reservations depending on their role. Never pretend to know live reservation data unless it is explicitly provided in the verified answer. If live data is unavailable, clearly say so and suggest where the user can check in the system. Keep answers concise but useful, and never output JSON, code fences, or internal notes.`;

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

    const baseResponse = await this.buildBaseResponse(currentUser, intent);

    if (intent.category === "out_of_scope") {
      contextManager.appendAssistantMessage(
        currentUser.id,
        currentUser.sessionId,
        baseResponse.reply,
        baseResponse.category,
        intent.previousQuery
      );

      return {
        ...baseResponse,
        mode: "fallback"
      };
    }

    const currentContext = contextManager.get(currentUser.id, currentUser.sessionId);
    const aiReply = await this.generateAiReply(
      message,
      baseResponse.reply,
      intent.language,
      currentContext?.messages ?? []
    );
    const finalResponse = {
      ...baseResponse,
      reply: aiReply ?? baseResponse.reply,
      mode: aiReply ? ("ai" as const) : ("fallback" as const)
    };

    contextManager.appendAssistantMessage(
      currentUser.id,
      currentUser.sessionId,
      finalResponse.reply,
      finalResponse.category,
      this.buildNextQuerySnapshot(intent, baseResponse.presentation)
    );

    return finalResponse;
  }

  private async buildBaseResponse(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>
  ) {
    if (intent.category === "out_of_scope") {
      return this.responseFormatter.formatOutOfScope(intent.language);
    }

    if (intent.category === "general_reservation_help") {
      const helpContext = await this.lookupService.getGeneralHelpContext(intent.range);
      return this.responseFormatter.formatGeneralHelp(intent.language, helpContext);
    }

    if (intent.category === "reservation_rules") {
      const rules = await this.lookupService.getRules();
      return this.responseFormatter.formatRules(intent.language, rules);
    }

    if (intent.category === "my_reservations") {
      const reservationContext = await this.lookupService.getUserReservations(
        currentUser,
        intent.range
      );
      return this.responseFormatter.formatReservations(
        intent.language,
        reservationContext,
        intent.range
      );
    }

    if (intent.category === "laboratory_lookup" && intent.laboratory) {
      const laboratoryContext = await this.lookupService.getLaboratoryLookup(intent.laboratory);
      return this.responseFormatter.formatLaboratoryLookup(intent.language, laboratoryContext);
    }

    if (intent.category === "specific_laboratory") {
      if (!intent.laboratory) {
        const suggestions = await this.lookupService.getLaboratorySuggestions();
        return this.responseFormatter.formatUnmatchedLaboratory(intent.language, suggestions);
      }

      const offset = intent.isShowMore ? intent.previousQuery?.resultOffset ?? 0 : 0;
      const scheduleContext = await this.lookupService.getScheduleAvailability(intent.range, {
        laboratoryId: intent.laboratory.id,
        offset
      });

      return this.responseFormatter.formatSpecificLaboratory(
        intent.language,
        intent.laboratory,
        scheduleContext
      );
    }

    if (intent.category === "available_laboratories") {
      const offset = intent.isShowMore ? intent.previousQuery?.resultOffset ?? 0 : 0;
      const laboratoryContext = await this.lookupService.getLaboratoryAvailability(intent.range, {
        offset
      });
      return this.responseFormatter.formatLaboratoryAvailability(
        intent.language,
        laboratoryContext
      );
    }

    const offset = intent.isShowMore ? intent.previousQuery?.resultOffset ?? 0 : 0;
    const scheduleContext = await this.lookupService.getScheduleAvailability(intent.range, {
      offset
    });
    return this.responseFormatter.formatScheduleAvailability(intent.language, scheduleContext);
  }

  private buildNextQuerySnapshot(
    intent: ReturnType<IntentDetector["detect"]>,
    presentation?: ReservationAssistantResponse["presentation"]
  ): AssistantQuerySnapshot | null {
    if (
      intent.category === "out_of_scope" ||
      intent.category === "reservation_rules" ||
      intent.category === "general_reservation_help"
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

  private async generateAiReply(
    userMessage: string,
    verifiedReply: string,
    language: "english" | "tagalog" | "taglish",
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>
  ) {
    if (env.NODE_ENV === "test") {
      return null;
    }

    const url = this.resolveAiApiUrl();

    if (!url || !env.AI_API_KEY || !env.AI_MODEL) {
      return null;
    }

    try {
      const recentHistory = conversationHistory
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
                `Latest user message: ${userMessage}`,
                `Preferred response language: ${language}`,
                `Verified system answer: ${verifiedReply}`,
                "Rewrite the verified system answer into a warm, natural reply for the latest user message.",
                "Do not add, infer, or change facts.",
                "If the verified answer says live data is unavailable, keep that limitation clear."
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
      console.error("[assistant] Falling back to deterministic reply.", error);
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
}
