import { randomUUID } from "crypto";

import dayjs from "dayjs";
import type {
  LaboratoryStatus,
  PrismaClient,
  ReservationStatus,
  ReservationType,
  ScheduleStatus
} from "@prisma/client";

import { env } from "../config/env.js";
import { LaboratoryService } from "./LaboratoryService.js";
import { ReservationService } from "./ReservationService.js";
import { ScheduleService } from "./ScheduleService.js";
import { AssistantToolService } from "./assistant/AssistantToolService.js";
import { ContextManager } from "./assistant/ContextManager.js";
import { DateRangeParser } from "./assistant/DateRangeParser.js";
import { IntentDetector } from "./assistant/IntentDetector.js";
import { PendingActionStore } from "./assistant/PendingActionStore.js";
import { ResponseFormatter } from "./assistant/ResponseFormatter.js";
import { normalizeAssistantText } from "./assistant/text.js";
import type {
  AssistantActionType,
  AssistantActiveFlow,
  AssistantCategory,
  AssistantConfirmationLevel,
  AssistantPendingActionCard,
  AssistantPendingActionPayload,
  AssistantPendingActionRecord,
  AssistantPresentation,
  AssistantQuerySnapshot,
  CurrentUser,
  CurrentUserContextResult,
  LaboratorySummary,
  ReservationAssistantResponse,
  ReservationSummary
} from "./assistant/types.js";

const contextManager = new ContextManager();
const pendingActionStore = new PendingActionStore();
const MAX_AI_HISTORY_MESSAGES = 16;
const COMPORT_GPT_SYSTEM_PROMPT = `You are ComPort GPT, the role-aware AI assistant for the ComPort / ComLab Reservation System. You answer questions using the provided authenticated user context, reservation records, laboratory records, schedule and availability records, notification records, activity records, and approved system information. Answer in the same language as the user. If the user uses Tagalog, answer in Tagalog. If the user uses English, answer in English. If the user mixes Tagalog and English, answer in natural Taglish. Never invent database facts. If the provided context does not contain the answer, say that you cannot confirm it from the system records yet. Respect user roles and permissions. Students can only access their own records. Laboratory staff and admins can access broader reservation and management data only when the provided context shows they are allowed. Do not reveal passwords, hashes, tokens, secrets, reset data, verification data, or unrelated private information. Keep answers concise, warm, and clear. Never output JSON, code fences, or internal notes.`;
const CONFIRM_SYNONYMS = new Set([
  "confirm",
  "yes",
  "proceed",
  "create it",
  "approve it",
  "submit it"
]);
const CANCEL_SYNONYMS = new Set([
  "cancel",
  "cancel it",
  "stop",
  "never mind",
  "wag",
  "huwag"
]);
const WEEKDAY_INDEX_BY_NAME = new Map<string, number>([
  ["monday", 1],
  ["lunes", 1],
  ["tuesday", 2],
  ["martes", 2],
  ["wednesday", 3],
  ["miyerkules", 3],
  ["mierkules", 3],
  ["thursday", 4],
  ["huwebes", 4],
  ["friday", 5],
  ["biyernes", 5],
  ["saturday", 6],
  ["sabado", 6],
  ["sunday", 0],
  ["linggo", 0]
]);

type BuiltAssistantResponse = {
  response: Omit<ReservationAssistantResponse, "mode">;
  aiContext: string;
};

type HandledResponse = {
  response: Omit<ReservationAssistantResponse, "mode">;
  query: AssistantQuerySnapshot | null;
};

type ParsedTimeRange = {
  startTime: string;
  endTime: string;
};

type ScheduleDraftEntry = {
  laboratoryId: number;
  laboratoryName: string;
  roomCode: string;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
};

export class ReservationAssistantService {
  private readonly tools: AssistantToolService;
  private readonly intentDetector: IntentDetector;
  private readonly responseFormatter = new ResponseFormatter();
  private readonly reservationService: ReservationService;
  private readonly scheduleService: ScheduleService;
  private readonly laboratoryService: LaboratoryService;

  constructor(private readonly db: PrismaClient) {
    this.tools = new AssistantToolService(db);
    this.intentDetector = new IntentDetector(new DateRangeParser());
    this.reservationService = new ReservationService(db);
    this.scheduleService = new ScheduleService(db);
    this.laboratoryService = new LaboratoryService(db);
  }

  async askReservationAssistant(
    currentUser: CurrentUser,
    message: string
  ): Promise<ReservationAssistantResponse> {
    const context = contextManager.get(currentUser.id, currentUser.sessionId);
    const laboratories = await this.tools.listLaboratories();
    const intent = this.intentDetector.detect(message, laboratories, context);
    const activeFlowBefore = context?.activeFlow?.activeFlow ?? null;

    this.logAssistantRoute(
      intent.normalizedMessage,
      intent.category,
      "rule-based",
      activeFlowBefore,
      null
    );

    contextManager.appendUserMessage(
      currentUser.id,
      currentUser.sessionId,
      intent.language,
      message
    );

    const authenticatedUserContext = await this.tools.getCurrentUserContext(currentUser);

    const inlineActionResponse = await this.handleInlineActionControl(
      currentUser,
      message,
      intent.language
    );

    if (inlineActionResponse) {
      return this.finalizeResponse(currentUser, inlineActionResponse.response, inlineActionResponse.query);
    }

    const activeFlowResponse = await this.tryContinueActiveFlow(
      currentUser,
      message,
      intent,
      laboratories
    );

    if (activeFlowResponse) {
      return this.finalizeResponse(currentUser, activeFlowResponse.response, activeFlowResponse.query);
    }

    if (intent.category === "reservation_guide") {
      const guideResponse = this.buildReservationGuideResponse(currentUser, intent);
      return this.finalizeResponse(currentUser, guideResponse.response, guideResponse.query);
    }

    const draftedAction = await this.tryDraftWriteAction(
      currentUser,
      intent,
      laboratories,
      authenticatedUserContext
    );

    if (draftedAction) {
      return this.finalizeResponse(currentUser, draftedAction.response, draftedAction.query);
    }

    const extendedRead = await this.tryHandleExtendedReadIntent(
      currentUser,
      intent,
      authenticatedUserContext
    );

    if (extendedRead) {
      return this.finalizeResponse(currentUser, extendedRead.response, extendedRead.query);
    }

    const builtResponse = await this.buildLegacyResponse(
      currentUser,
      intent,
      authenticatedUserContext
    );
    const currentContext = contextManager.get(currentUser.id, currentUser.sessionId);
    const aiReply = this.shouldUseAiRewrite(intent.category)
      ? await this.generateAiReply({
          userMessage: message,
          verifiedReply: builtResponse.response.reply,
          verifiedContext: builtResponse.aiContext,
          authenticatedUserContext,
          language: intent.language,
          conversationHistory: currentContext?.messages ?? [],
          intent: intent.category,
          role: currentUser.role
        })
      : null;
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
    this.logAssistantActiveFlow(
      "after",
      contextManager.get(currentUser.id, currentUser.sessionId)?.activeFlow?.activeFlow ?? null
    );

    return finalResponse;
  }

  async confirmPendingAction(
    currentUser: CurrentUser,
    actionId: string,
    confirmationText?: string
  ): Promise<ReservationAssistantResponse> {
    const action = pendingActionStore.get(actionId);
    const previousQuery = contextManager.get(currentUser.id, currentUser.sessionId)?.activeQuery ?? null;

    if (!action || action.requestedByUserId !== currentUser.id || action.sessionId !== currentUser.sessionId) {
      const response = {
        reply: this.pick(this.inferLanguage(currentUser), {
          english: "I couldn't find that pending action anymore. Please ask me to prepare it again.",
          tagalog: "Hindi ko na mahanap ang pending action na iyon. Pakiusap, ipahanda mo ulit sa akin.",
          taglish: "Hindi ko na mahanap ang pending action na iyon. Please ipahanda mo ulit sa akin."
        }),
        category: "clarification" as const,
        suggestions: this.roleAwareSuggestions(currentUser.role, this.inferLanguage(currentUser))
      };

      contextManager.appendAssistantMessage(
        currentUser.id,
        currentUser.sessionId,
        response.reply,
        response.category,
        previousQuery
      );

      return {
        ...response,
        mode: "fallback"
      };
    }

    if (action.expiresAt <= Date.now()) {
      pendingActionStore.delete(action.actionId);
      contextManager.setPendingActionId(currentUser.id, currentUser.sessionId, null);

      const response = {
        reply: this.pick(action.language, {
          english: "That pending action has already expired. I can prepare a fresh draft if you still want to continue.",
          tagalog: "Expired na ang pending action na iyon. Pwede akong gumawa ng bagong draft kung gusto mo pa ring ituloy.",
          taglish: "Expired na ang pending action na iyon. Pwede akong gumawa ng fresh draft kung gusto mo pa ring ituloy."
        }),
        category: "clarification" as const,
        suggestions: this.roleAwareSuggestions(currentUser.role, action.language)
      };

      contextManager.appendAssistantMessage(
        currentUser.id,
        currentUser.sessionId,
        response.reply,
        response.category,
        previousQuery
      );

      return {
        ...response,
        mode: "fallback"
      };
    }

    const confirmationError = this.validateConfirmation(action, confirmationText);

    if (confirmationError) {
      const response = {
        reply: confirmationError,
        category: "clarification" as const,
        suggestions: this.confirmationSuggestions(action)
      };

      contextManager.appendAssistantMessage(
        currentUser.id,
        currentUser.sessionId,
        response.reply,
        response.category,
        previousQuery
      );

      return {
        ...response,
        mode: "fallback"
      };
    }

    const executionResponse = await this.executePendingAction(currentUser, action);
    pendingActionStore.delete(action.actionId);
    contextManager.setPendingActionId(currentUser.id, currentUser.sessionId, null);

    contextManager.appendAssistantMessage(
      currentUser.id,
      currentUser.sessionId,
      executionResponse.reply,
      executionResponse.category,
      previousQuery
    );

    return {
      ...executionResponse,
      mode: "fallback"
    };
  }

  async cancelPendingAction(
    currentUser: CurrentUser,
    actionId: string
  ): Promise<ReservationAssistantResponse> {
    const action = pendingActionStore.get(actionId);
    const language = action?.language ?? this.inferLanguage(currentUser);
    const previousQuery = contextManager.get(currentUser.id, currentUser.sessionId)?.activeQuery ?? null;

    if (!action || action.requestedByUserId !== currentUser.id || action.sessionId !== currentUser.sessionId) {
      const response = {
        reply: this.pick(language, {
          english: "I couldn't find that pending action anymore, so there was nothing to cancel.",
          tagalog: "Hindi ko na mahanap ang pending action na iyon, kaya wala akong nakansela.",
          taglish: "Hindi ko na mahanap ang pending action na iyon, kaya wala akong na-cancel."
        }),
        category: "clarification" as const,
        suggestions: this.roleAwareSuggestions(currentUser.role, language)
      };

      contextManager.appendAssistantMessage(
        currentUser.id,
        currentUser.sessionId,
        response.reply,
        response.category,
        previousQuery
      );

      return {
        ...response,
        mode: "fallback"
      };
    }

    pendingActionStore.delete(action.actionId);
    contextManager.setPendingActionId(currentUser.id, currentUser.sessionId, null);

    const response = {
      reply: this.pick(language, {
        english: `Okay, I cancelled the pending ${action.title.toLowerCase()} draft. No database changes were made.`,
        tagalog: `Sige, kinansela ko ang pending draft para sa ${action.title.toLowerCase()}. Walang binagong database records.`,
        taglish: `Sige, kinansela ko ang pending draft for ${action.title.toLowerCase()}. Walang binagong database records.`
      }),
      category: "action_cancelled" as const,
      suggestions: this.roleAwareSuggestions(currentUser.role, language)
    };

    contextManager.appendAssistantMessage(
      currentUser.id,
      currentUser.sessionId,
      response.reply,
      response.category,
      previousQuery
    );

    return {
      ...response,
      mode: "fallback"
    };
  }

  private async tryHandleExtendedReadIntent(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    authenticatedUserContext: CurrentUserContextResult | null
  ): Promise<HandledResponse | null> {
    const message = intent.normalizedMessage;

    if (this.isRoleCapabilityQuestion(message)) {
      const capabilities = await this.tools.getRoleCapabilities(currentUser);
      const response: Omit<ReservationAssistantResponse, "mode"> = {
        reply: this.pick(intent.language, {
          english: `You are signed in as ${this.roleLabel(currentUser.role)}. Here is the role-aware access I can safely help you with.`,
          tagalog: `Naka-sign in ka bilang ${this.roleLabel(currentUser.role)}. Narito ang role-aware access na ligtas kong matutulungan ka.`,
          taglish: `Naka-sign in ka as ${this.roleLabel(currentUser.role)}. Ito ang role-aware access na safe kong matutulungan ka.`
        }),
        category: "role_capabilities",
        suggestions: this.roleAwareSuggestions(currentUser.role, intent.language),
        presentation: {
          type: "capabilities",
          title: this.pick(intent.language, {
            english: "Role capabilities",
            tagalog: "Mga kakayahan ng role",
            taglish: "Role capabilities"
          }),
          role: capabilities.role,
          read: capabilities.read,
          write: capabilities.write,
          denied: capabilities.denied,
          notes: capabilities.notes
        }
      };

      return {
        response,
        query: this.buildSimpleQuerySnapshot("role_capabilities", intent)
      };
    }

    if (currentUser.role === "LABORATORY_STAFF" && this.isAssignedLabQuestion(message)) {
      const assignedLab = await this.tools.getAssignedLaboratory(currentUser);
      const response: Omit<ReservationAssistantResponse, "mode"> = assignedLab
        ? {
            reply: this.pick(intent.language, {
              english: `Your primary assigned laboratory is ${assignedLab.roomCode} - ${assignedLab.name}.`,
              tagalog: `Ang primary assigned laboratory mo ay ${assignedLab.roomCode} - ${assignedLab.name}.`,
              taglish: `Ang primary assigned laboratory mo is ${assignedLab.roomCode} - ${assignedLab.name}.`
            }),
            category: "assigned_laboratory",
            suggestions: this.roleAwareSuggestions(currentUser.role, intent.language),
            presentation: {
              type: "assigned-laboratory",
              title: this.pick(intent.language, {
                english: "Assigned laboratory",
                tagalog: "Assigned laboratory",
                taglish: "Assigned laboratory"
              }),
              laboratory: assignedLab
            }
          }
        : {
            reply: this.pick(intent.language, {
              english: "I couldn't find an assigned laboratory for your staff account yet.",
              tagalog: "Wala pa akong makitang assigned laboratory para sa staff account mo.",
              taglish: "Wala pa akong makitang assigned laboratory for your staff account."
            }),
            category: "assigned_laboratory",
            suggestions: this.roleAwareSuggestions(currentUser.role, intent.language),
            presentation: {
              type: "assigned-laboratory",
              title: this.pick(intent.language, {
                english: "Assigned laboratory",
                tagalog: "Assigned laboratory",
                taglish: "Assigned laboratory"
              }),
              laboratory: null
            }
          };

      return {
        response,
        query: this.buildSimpleQuerySnapshot("assigned_laboratory", intent)
      };
    }

    if (this.isLaboratoryCatalogQuestion(message)) {
      const statusFilter: LaboratoryStatus | "NOT_AVAILABLE" | null =
        this.extractLaboratoryStatusFilter(message, currentUser.role);
      const catalogStatus: LaboratoryStatus | undefined =
        statusFilter === "AVAILABLE" ||
        statusFilter === "UNAVAILABLE" ||
        statusFilter === "MAINTENANCE"
          ? statusFilter
          : currentUser.role === "STUDENT"
            ? "AVAILABLE"
            : undefined;
      const laboratories =
        statusFilter === "NOT_AVAILABLE"
          ? await this.db.laboratory.findMany({
              where: {
                status: {
                  in: ["UNAVAILABLE", "MAINTENANCE"]
                }
              },
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
            }).then((rows) =>
              rows.map((laboratory) => ({
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
              }))
            )
          : await this.tools.getLaboratoryCatalog({
              status: catalogStatus
            });
      const reply = !laboratories.length
        ? this.pick(intent.language, {
            english: "I couldn't find any laboratories that match that status right now.",
            tagalog: "Wala akong makitang laboratories na tugma sa status na iyon sa ngayon.",
            taglish: "Wala akong makitang laboratories na match sa status na iyon right now."
          })
        : this.pick(intent.language, {
            english: `I found ${laboratories.length} laborator${laboratories.length === 1 ? "y" : "ies"} matching your request.`,
            tagalog: `May nakita akong ${laboratories.length} laborator${laboratories.length === 1 ? "y" : "ies"} na tugma sa request mo.`,
            taglish: `May nakita akong ${laboratories.length} laborator${laboratories.length === 1 ? "y" : "ies"} na match sa request mo.`
          });

      return {
        response: {
          reply,
          category: "laboratory_catalog",
          suggestions: this.roleAwareSuggestions(currentUser.role, intent.language),
          presentation: {
            type: "laboratory-catalog",
            title: this.pick(intent.language, {
              english: "Laboratories",
              tagalog: "Mga laboratoryo",
              taglish: "Laboratories"
            }),
            laboratories
          }
        },
        query: this.buildSimpleQuerySnapshot("laboratory_catalog", intent)
      };
    }

    if (currentUser.role !== "STUDENT" && this.isVisibleReservationQuery(message)) {
      const statuses = this.extractStatusFilters(message);
      const reservations = await this.tools.getReservationsForRole(currentUser, intent.range, {
        laboratoryId: intent.laboratory?.id,
        statuses,
        limit: 12
      });

      if (!reservations || !reservations.reservations.length) {
        return {
          response: {
            reply: this.pick(intent.language, {
              english: "I couldn't find visible reservations that match that filter right now.",
              tagalog: "Wala akong makitang visible reservations na tumutugma sa filter na iyon sa ngayon.",
              taglish: "Wala akong makitang visible reservations na tugma sa filter na iyon right now."
            }),
            category: "visible_reservations",
            suggestions: this.roleAwareSuggestions(currentUser.role, intent.language)
          },
          query: this.buildSimpleQuerySnapshot("visible_reservations", intent)
        };
      }

      return {
        response: {
          reply: this.pick(intent.language, {
            english: `Here are the visible reservations I found for ${intent.range.label}.`,
            tagalog: `Narito ang visible reservations na nakita ko para sa ${intent.range.label}.`,
            taglish: `Ito ang visible reservations na nakita ko for ${intent.range.label}.`
          }),
          category: "visible_reservations",
          suggestions: this.roleAwareSuggestions(currentUser.role, intent.language),
          presentation: {
            type: "reservation-results",
            title: this.pick(intent.language, {
              english: "Visible reservations",
              tagalog: "Visible reservations",
              taglish: "Visible reservations"
            }),
            reservations: reservations.reservations
          }
        },
        query: this.buildSimpleQuerySnapshot("visible_reservations", intent)
      };
    }

    if (this.isAnalyticsQuestion(message)) {
      const analytics = await this.tools.getUsageAnalyticsForRole(currentUser, intent.range, {
        laboratoryId: intent.laboratory?.id
      });
      const systemStats =
        currentUser.role === "STUDENT" ? null : await this.tools.getSystemStatsForRole(currentUser);
      const items = [
        { label: "Range", value: intent.range.label },
        { label: "Total reservations", value: String(analytics.totals.total) },
        { label: "Pending", value: String(analytics.totals.pending) },
        { label: "Approved", value: String(analytics.totals.approved) },
        { label: "Rejected", value: String(analytics.totals.rejected) },
        { label: "Cancelled", value: String(analytics.totals.cancelled) },
        { label: "Completed", value: String(analytics.totals.completed) },
        {
          label: "Most used laboratory",
          value: analytics.mostUsedLab
            ? `${analytics.mostUsedLab[0]} (${analytics.mostUsedLab[1]})`
            : "No data"
        },
        {
          label: "Busiest day",
          value: analytics.busiestDay
            ? `${analytics.busiestDay[0]} (${analytics.busiestDay[1]})`
            : "No data"
        }
      ];

      if (systemStats?.stats.length) {
        items.push({
          label: "Managed laboratories",
          value:
            String(systemStats.stats.find((item) => item.label === "Managed laboratories")?.value ?? 0)
        });
      }

      return {
        response: {
          reply: this.pick(intent.language, {
            english: `Here is the reservation summary I confirmed from the current system records for ${intent.range.label}.`,
            tagalog: `Narito ang reservation summary na na-confirm ko mula sa current system records para sa ${intent.range.label}.`,
            taglish: `Ito ang reservation summary na na-confirm ko from the current system records for ${intent.range.label}.`
          }),
          category: "usage_analytics",
          suggestions: this.roleAwareSuggestions(currentUser.role, intent.language),
          presentation: {
            type: "summary",
            title: this.pick(intent.language, {
              english: "Reservation summary",
              tagalog: "Reservation summary",
              taglish: "Reservation summary"
            }),
            items,
            notes: analytics.mostUsedLab
              ? [
                  this.pick(intent.language, {
                    english: `${analytics.mostUsedLab[0]} is the most used laboratory in this range.`,
                    tagalog: `${analytics.mostUsedLab[0]} ang pinaka-gamit na laboratoryo sa range na ito.`,
                    taglish: `${analytics.mostUsedLab[0]} ang pinaka-gamit na laboratory sa range na ito.`
                  })
                ]
              : undefined
          }
        },
        query: this.buildSimpleQuerySnapshot("usage_analytics", intent)
      };
    }

    if (
      currentUser.role === "STUDENT" &&
      authenticatedUserContext &&
      message.includes("role")
    ) {
      return {
        response: {
          reply: this.pick(intent.language, {
            english: `Your role in ComPort is ${this.roleLabel(authenticatedUserContext.role)}.`,
            tagalog: `Ang role mo sa ComPort ay ${this.roleLabel(authenticatedUserContext.role)}.`,
            taglish: `Ang role mo sa ComPort is ${this.roleLabel(authenticatedUserContext.role)}.`
          }),
          category: "current_user",
          suggestions: this.roleAwareSuggestions(currentUser.role, intent.language)
        },
        query: this.buildSimpleQuerySnapshot("current_user", intent)
      };
    }

    return null;
  }

  private async tryDraftWriteAction(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    laboratories: LaboratorySummary[],
    authenticatedUserContext: CurrentUserContextResult | null
  ): Promise<HandledResponse | null> {
    const message = intent.normalizedMessage;

    if (intent.category === "reservation_guide") {
      return null;
    }

    if (this.isReservationCreationCommand(message)) {
      return this.draftReservationCreation(currentUser, intent);
    }

    if (this.isReservationCancellationCommand(message)) {
      return this.draftReservationCancellation(currentUser, intent);
    }

    if (this.isReservationReviewCommand(message)) {
      return this.draftReservationReview(currentUser, intent);
    }

    if (this.isScheduleCreationCommand(message)) {
      return this.draftScheduleCreation(currentUser, intent);
    }

    if (this.isLaboratoryManagementCommand(message, intent.laboratory, laboratories)) {
      return this.draftLaboratoryManagement(currentUser, intent, authenticatedUserContext);
    }

    return null;
  }

  private async handleInlineActionControl(
    currentUser: CurrentUser,
    message: string,
    language: AssistantPendingActionRecord["language"]
  ): Promise<HandledResponse | null> {
    const normalized = normalizeAssistantText(message);
    const pendingActionId = contextManager.getPendingActionId(currentUser.id, currentUser.sessionId);

    if (!pendingActionId) {
      const activeFlow = contextManager.getActiveFlow(currentUser.id, currentUser.sessionId);

      if (activeFlow && CANCEL_SYNONYMS.has(normalized)) {
        contextManager.clearActiveFlow(currentUser.id, currentUser.sessionId);

        return {
          response: {
            reply: this.pick(language, {
              english: "Okay, I cancelled the current assistant flow. No database changes were made.",
              tagalog: "Sige, kinansela ko ang current assistant flow. Walang binagong database records.",
              taglish: "Sige, cancelled ang current assistant flow. Walang binagong database records."
            }),
            category: "action_cancelled",
            suggestions: this.roleAwareSuggestions(currentUser.role, language)
          },
          query: contextManager.get(currentUser.id, currentUser.sessionId)?.activeQuery ?? null
        };
      }

      if (CONFIRM_SYNONYMS.has(normalized) || normalized.startsWith("confirm ")) {
        return {
          response: {
            reply: this.pick(language, {
              english: "I do not have a pending action to confirm yet.",
              tagalog: "Wala pa akong pending action na iko-confirm.",
              taglish: "Wala pa akong pending action to confirm yet."
            }),
            category: "clarification",
            suggestions: this.roleAwareSuggestions(currentUser.role, language)
          },
          query: contextManager.get(currentUser.id, currentUser.sessionId)?.activeQuery ?? null
        };
      }

      return null;
    }

    if (CANCEL_SYNONYMS.has(normalized)) {
      const response = await this.cancelPendingAction(currentUser, pendingActionId);
      return {
        response: {
          ...response
        },
        query: contextManager.get(currentUser.id, currentUser.sessionId)?.activeQuery ?? null
      };
    }

    if (CONFIRM_SYNONYMS.has(normalized) || normalized.startsWith("confirm ")) {
      const response = await this.confirmPendingAction(currentUser, pendingActionId, message);
      return {
        response: {
          ...response
        },
        query: contextManager.get(currentUser.id, currentUser.sessionId)?.activeQuery ?? null
      };
    }

    return null;
  }

  private async tryContinueActiveFlow(
    currentUser: CurrentUser,
    message: string,
    intent: ReturnType<IntentDetector["detect"]>,
    laboratories: LaboratorySummary[]
  ): Promise<HandledResponse | null> {
    const flow = contextManager.getActiveFlow(currentUser.id, currentUser.sessionId);

    if (!flow) {
      return null;
    }

    if (intent.category === "reservation_guide") {
      return this.buildReservationGuideResponse(currentUser, intent);
    }

    if (flow.activeFlow === "GUIDED_RESERVATION_FLOW") {
      return this.continueGuidedReservationFlow(currentUser, intent, laboratories, flow);
    }

    if (
      flow.activeIntent !== "CREATE_SCHEDULE_DRAFT" &&
      flow.activeIntent !== "CREATE_BULK_SCHEDULE_DRAFT"
    ) {
      return null;
    }

    const normalized = normalizeAssistantText(message);
    const savedTimeRange = flow.collectedSlots.timeRange as ParsedTimeRange | undefined;
    const messageTimeRange = this.extractTimeRange(normalized);
    const timeRange = messageTimeRange ?? savedTimeRange ?? null;
    const savedRange = flow.collectedSlots.range as ReturnType<IntentDetector["detect"]>["range"] | undefined;
    const range = intent.range.source === "default" && savedRange ? savedRange : intent.range;
    const saysAllActiveLabs =
      normalized.includes("all active labs") ||
      normalized.includes("all labs") ||
      normalized.includes("lahat ng active") ||
      normalized.includes("lahat labs") ||
      normalized.includes("lahat ng labs");
    const laboratory =
      intent.laboratory ??
      (typeof flow.collectedSlots.laboratoryId === "number"
        ? laboratories.find((candidate) => candidate.id === flow.collectedSlots.laboratoryId) ?? null
        : null);

    if (!timeRange) {
      this.rememberScheduleFlow(currentUser, intent, {
        range,
        laboratory,
        timeRange: null,
        useAllActiveLabs: saysAllActiveLabs,
        lastQuestionAsked: "What start and end time should I use for the schedule?"
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        "What start and end time should I use for the schedule? For example: 08:00 to 17:00.",
        {
          ...intent,
          range,
          laboratory
        }
      );
    }

    const syntheticIntent = {
      ...intent,
      range,
      laboratory,
      normalizedMessage: [
        "create schedule",
        saysAllActiveLabs || flow.collectedSlots.useAllActiveLabs ? "all active labs" : "",
        laboratory?.roomCode ?? "",
        `${timeRange.startTime} to ${timeRange.endTime}`,
        normalized
      ].filter(Boolean).join(" ")
    };

    return this.draftScheduleCreation(currentUser, syntheticIntent);
  }

  private buildReservationGuideResponse(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>
  ): HandledResponse {
    this.rememberGuidedReservationFlow(currentUser, intent, {
      currentStep: "select_laboratory",
      filledSlots: {},
      missingSlots: ["laboratory", "date", "schedule"],
      lastQuestionAsked: "Which laboratory would you like to reserve?"
    });

    return {
      response: {
        reply: this.buildReservationGuideReply(currentUser.role),
        category: "reservation_guide",
        suggestions: ["CL-302", "Show available labs"]
      },
      query: intent.previousQuery
    };
  }

  private async continueGuidedReservationFlow(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    laboratories: LaboratorySummary[],
    flow: AssistantActiveFlow
  ): Promise<HandledResponse | null> {
    if (intent.category === "available_laboratories") {
      return null;
    }

    const normalized = intent.normalizedMessage;
    const filledSlots = {
      ...flow.collectedSlots,
      ...(flow.filledSlots ?? {})
    };
    const savedLaboratory =
      typeof filledSlots.laboratoryId === "number"
        ? laboratories.find((candidate) => candidate.id === filledSlots.laboratoryId) ?? null
        : null;
    const laboratory = intent.laboratory ?? savedLaboratory;
    const savedRange = filledSlots.range as ReturnType<IntentDetector["detect"]>["range"] | undefined;
    const range = intent.range.source === "default" && savedRange ? savedRange : intent.range;
    const savedTimeRange = filledSlots.timeRange as ParsedTimeRange | undefined;
    const timeRange = this.extractTimeRange(normalized) ?? savedTimeRange ?? null;
    const extractedPurpose = this.extractPurpose(normalized);
    const savedPurpose = typeof filledSlots.purpose === "string" ? filledSlots.purpose : null;
    const purpose =
      extractedPurpose ??
      (flow.currentStep === "enter_purpose" && normalized.length >= 5 ? normalized : savedPurpose);

    if (!laboratory) {
      return this.startGuidedReservationFlowResponse(currentUser, intent, {
        range,
        timeRange,
        purpose,
        question: "Which laboratory would you like to reserve? Try the exact room code such as CL-302."
      });
    }

    if (range.granularity !== "day" || range.source === "default") {
      this.rememberGuidedReservationFlow(currentUser, intent, {
        currentStep: "select_date",
        filledSlots: {
          laboratoryId: laboratory.id,
          laboratoryRoomCode: laboratory.roomCode,
          ...(timeRange ? { timeRange } : {}),
          ...(purpose ? { purpose } : {})
        },
        missingSlots: ["date", "schedule"],
        lastQuestionAsked: `What date would you like to reserve ${laboratory.roomCode}?`
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        `What date would you like to reserve ${laboratory.roomCode}? For example: tomorrow or May 26.`,
        {
          ...intent,
          laboratory
        }
      );
    }

    if (!timeRange) {
      this.rememberGuidedReservationFlow(currentUser, intent, {
        currentStep: "select_schedule",
        filledSlots: {
          laboratoryId: laboratory.id,
          laboratoryRoomCode: laboratory.roomCode,
          range,
          ...(purpose ? { purpose } : {})
        },
        missingSlots: ["schedule"],
        lastQuestionAsked: `What time block would you like for ${laboratory.roomCode}?`
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        `What time block would you like for ${laboratory.roomCode}? For example: 09:00 to 10:00.`,
        {
          ...intent,
          range,
          laboratory
        }
      );
    }

    if (!purpose || purpose.length < 5) {
      this.rememberGuidedReservationFlow(currentUser, intent, {
        currentStep: "enter_purpose",
        filledSlots: {
          laboratoryId: laboratory.id,
          laboratoryRoomCode: laboratory.roomCode,
          range,
          timeRange
        },
        missingSlots: [],
        lastQuestionAsked: "What is the reservation purpose?"
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        "What is the reservation purpose? Please include a short purpose such as programming, thesis work, or lab activity.",
        {
          ...intent,
          range,
          laboratory
        }
      );
    }

    contextManager.clearActiveFlow(currentUser.id, currentUser.sessionId);

    return this.draftReservationCreation(currentUser, {
      ...intent,
      category: "specific_laboratory",
      range,
      laboratory,
      normalizedMessage: [
        "reserve",
        laboratory.roomCode,
        `${timeRange.startTime} to ${timeRange.endTime}`,
        `for ${purpose}`
      ].join(" ")
    });
  }

  private async draftReservationCreation(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>
  ): Promise<HandledResponse> {
    if (currentUser.role !== "STUDENT") {
      return this.permissionDeniedResponse(
        currentUser,
        intent.language,
        "Reservation creation through the assistant is only available for student reservation requests."
      );
    }

    const laboratory = intent.laboratory;
    const timeRange = this.extractTimeRange(intent.normalizedMessage);
    const purpose = this.extractPurpose(intent.normalizedMessage);

    if (!laboratory) {
      return this.startGuidedReservationFlowResponse(currentUser, intent, {
        timeRange,
        purpose,
        range: intent.range.source === "default" ? undefined : intent.range,
        question: "Sure, I will guide you through creating a reservation. Which laboratory would you like to reserve? Try the exact room code such as CL-302."
      });
    }

    if (intent.range.granularity !== "day" || intent.range.source === "default") {
      this.rememberGuidedReservationFlow(currentUser, intent, {
        currentStep: "select_date",
        filledSlots: {
          laboratoryId: laboratory.id,
          laboratoryRoomCode: laboratory.roomCode,
          ...(timeRange ? { timeRange } : {}),
          ...(purpose ? { purpose } : {})
        },
        missingSlots: ["date", "schedule"],
        lastQuestionAsked: `What date would you like to reserve ${laboratory.roomCode}?`
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        `I can help with that reservation request, but I still need one specific date for ${laboratory.roomCode}.`,
        intent
      );
    }

    if (!timeRange) {
      this.rememberGuidedReservationFlow(currentUser, intent, {
        currentStep: "select_schedule",
        filledSlots: {
          laboratoryId: laboratory.id,
          laboratoryRoomCode: laboratory.roomCode,
          range: intent.range,
          ...(purpose ? { purpose } : {})
        },
        missingSlots: ["schedule"],
        lastQuestionAsked: `What time block would you like for ${laboratory.roomCode}?`
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        "What time range should I use? For example: 09:00 to 10:00.",
        intent
      );
    }

    if (!purpose || purpose.length < 5) {
      this.rememberGuidedReservationFlow(currentUser, intent, {
        currentStep: "enter_purpose",
        filledSlots: {
          laboratoryId: laboratory.id,
          laboratoryRoomCode: laboratory.roomCode,
          range: intent.range,
          timeRange
        },
        missingSlots: [],
        lastQuestionAsked: "What is the reservation purpose?"
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        "What is the reservation purpose? Please include a short purpose such as programming, thesis work, or lab activity.",
        intent
      );
    }

    const targetDate = dayjs(intent.range.start).format("YYYY-MM-DD");
    const matchingSchedule = await this.tools.findMatchingSchedule(
      laboratory.id,
      targetDate,
      timeRange.startTime,
      timeRange.endTime
    );

    if (!matchingSchedule) {
      return {
        response: {
          reply: this.pick(intent.language, {
            english: `I couldn't confirm a published schedule for ${laboratory.roomCode} on ${targetDate} that covers ${timeRange.startTime}-${timeRange.endTime}.`,
            tagalog: `Wala akong ma-confirm na published schedule para sa ${laboratory.roomCode} sa ${targetDate} na sumasaklaw sa ${timeRange.startTime}-${timeRange.endTime}.`,
            taglish: `Wala akong ma-confirm na published schedule for ${laboratory.roomCode} on ${targetDate} na covered ang ${timeRange.startTime}-${timeRange.endTime}.`
          }),
          category: "clarification",
          suggestions: [
            `Available ba ${laboratory.roomCode} ${targetDate}?`,
            "Show available schedules tomorrow."
          ]
        },
        query: intent.previousQuery
      };
    }

    const action = this.storePendingAction(currentUser, {
      actionId: randomUUID(),
      actionType: "CREATE_RESERVATION",
      requestedByUserId: currentUser.id,
      requestedByRole: currentUser.role,
      sessionId: currentUser.sessionId,
      targetRecords: {
        laboratoryIds: [laboratory.id],
        laboratoryRoomCodes: [laboratory.roomCode]
      },
      affectedCount: 1,
      title: "Reservation request",
      summary: `${laboratory.roomCode} on ${targetDate} from ${timeRange.startTime} to ${timeRange.endTime} for ${purpose}.`,
      warnings: [
        "The request will still follow the normal reservation workflow after confirmation."
      ],
      requiredConfirmationLevel: "LOW",
      confirmationPhrase: null,
      language: intent.language,
      payload: {
        kind: "create-reservation",
        input: {
          scheduleId: matchingSchedule.id,
          laboratoryId: laboratory.id,
          reservationType: "LAB",
          purpose,
          startTime: timeRange.startTime,
          endTime: timeRange.endTime
        }
      }
    });

    return {
      response: {
        reply: this.pick(intent.language, {
          english: "I prepared a reservation request draft. Review the details below, then confirm when you're ready.",
          tagalog: "Naghanda ako ng reservation request draft. Suriin mo ang details sa ibaba, tapos i-confirm kapag handa ka na.",
          taglish: "Naghanda ako ng reservation request draft. Review mo ang details sa ibaba, tapos confirm kapag ready ka na."
        }),
        category: "action_preview",
        suggestions: this.confirmationSuggestions(action),
        pendingAction: this.toPendingActionCard(action)
      },
      query: intent.previousQuery
    };
  }

  private async draftReservationCancellation(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>
  ): Promise<HandledResponse> {
    if (currentUser.role !== "STUDENT") {
      return this.permissionDeniedResponse(
        currentUser,
        intent.language,
        "Only students can cancel their own reservation requests through the assistant."
      );
    }

    const reservationContext = await this.tools.getReservationsForCurrentUser(currentUser, intent.range, {
      statuses: ["PENDING"],
      upcomingOnly: true,
      take: 8
    });
    const candidates = reservationContext.reservations.filter(
      (reservation) =>
        (!intent.laboratory || reservation.roomCode === intent.laboratory.roomCode) &&
        reservation.status === "PENDING"
    );

    if (!candidates.length) {
      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I couldn't find a pending reservation of yours that matches that request.",
            tagalog: "Wala akong makitang pending reservation mo na tugma sa request na iyon.",
            taglish: "Wala akong makitang pending reservation mo na match sa request na iyon."
          }),
          category: "clarification",
          suggestions: ["Show my upcoming reservations.", "What is my latest reservation status?"]
        },
        query: intent.previousQuery
      };
    }

    if (candidates.length > 1) {
      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I found more than one pending reservation that matches. Please tell me the room code or reservation date so I cancel the correct one.",
            tagalog: "Mahigit isang pending reservation ang tumugma. Sabihin mo ang room code o reservation date para makansela ko ang tama.",
            taglish: "More than one pending reservation ang tumugma. Sabihin mo ang room code or reservation date para makansela ko ang tama."
          }),
          category: "clarification",
          suggestions: candidates.slice(0, 3).map(
            (reservation) =>
              `Cancel ${reservation.roomCode} ${reservation.date} ${reservation.startTime}-${reservation.endTime}`
          )
        },
        query: intent.previousQuery
      };
    }

    const target = candidates[0];
    const action = this.storePendingAction(currentUser, {
      actionId: randomUUID(),
      actionType: "CANCEL_RESERVATION",
      requestedByUserId: currentUser.id,
      requestedByRole: currentUser.role,
      sessionId: currentUser.sessionId,
      targetRecords: {
        reservationIds: target.id ? [target.id] : [],
        reservationCodes: [target.reservationCode],
        laboratoryRoomCodes: [target.roomCode]
      },
      affectedCount: 1,
      title: "Reservation cancellation",
      summary: `${target.reservationCode} for ${target.roomCode} on ${target.date} from ${target.startTime} to ${target.endTime}.`,
      warnings: ["Only pending reservations can be cancelled."],
      requiredConfirmationLevel: "LOW",
      confirmationPhrase: null,
      language: intent.language,
      payload: {
        kind: "cancel-reservation",
        reservationId: target.id!
      }
    });

    return {
      response: {
        reply: this.pick(intent.language, {
          english: "I prepared the cancellation draft. Confirm it when you're ready and I will submit the cancellation.",
          tagalog: "Naihanda ko na ang cancellation draft. I-confirm mo lang kapag handa ka na at isusumite ko ang cancellation.",
          taglish: "Prepared na ang cancellation draft. Confirm mo lang kapag ready ka na at isusumite ko ang cancellation."
        }),
        category: "action_preview",
        suggestions: this.confirmationSuggestions(action),
        pendingAction: this.toPendingActionCard(action)
      },
      query: intent.previousQuery
    };
  }

  private async draftReservationReview(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>
  ): Promise<HandledResponse> {
    if (currentUser.role === "STUDENT") {
      return this.permissionDeniedResponse(
        currentUser,
        intent.language,
        "Students are not allowed to approve or reject reservations."
      );
    }

    const reviewStatus = this.extractReviewStatus(intent.normalizedMessage);

    if (!reviewStatus) {
      return this.clarificationResponse(
        currentUser,
        intent.language,
        "Do you want me to approve or reject the reservation request?",
        intent
      );
    }

    const isBulk = /\ball\b|\blahat\b/.test(intent.normalizedMessage);
    const remarks = this.extractReason(intent.normalizedMessage);

    if (isBulk && this.isAmbiguousBulkReview(intent)) {
      return this.clarificationResponse(
        currentUser,
        intent.language,
        `Do you mean ${reviewStatus === "APPROVED" ? "approve" : "reject"} all pending reservations for today, this week, or a specific laboratory?`,
        intent
      );
    }

    const visibleReservations = await this.db.reservation.findMany({
      where: await this.buildReviewWhere(currentUser, intent, intent.laboratory?.id, "PENDING"),
      select: {
        id: true,
        reservationCode: true,
        reservationDate: true,
        startTime: true,
        endTime: true,
        laboratory: {
          select: {
            name: true,
            roomCode: true
          }
        },
        student: {
          select: {
            firstName: true,
            lastName: true,
            studentNumber: true
          }
        },
        status: true,
        purpose: true,
        reservationType: true,
        remarks: true,
        reviewedBy: {
          select: {
            firstName: true,
            lastName: true
          }
        },
        pc: {
          select: {
            pcNumber: true
          }
        }
      },
      orderBy: [{ reservationDate: "asc" }, { startTime: "asc" }]
    });

    if (!visibleReservations.length) {
      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I couldn't find pending reservations that match that review request.",
            tagalog: "Wala akong makitang pending reservations na tugma sa review request na iyon.",
            taglish: "Wala akong makitang pending reservations na match sa review request na iyon."
          }),
          category: "clarification",
          suggestions: this.roleAwareSuggestions(currentUser.role, intent.language)
        },
        query: intent.previousQuery
      };
    }

    if (isBulk) {
      const action = this.storePendingAction(currentUser, {
        actionId: randomUUID(),
        actionType:
          reviewStatus === "APPROVED"
            ? "BULK_APPROVE_RESERVATIONS"
            : "BULK_REJECT_RESERVATIONS",
        requestedByUserId: currentUser.id,
        requestedByRole: currentUser.role,
        sessionId: currentUser.sessionId,
        targetRecords: {
          reservationIds: visibleReservations.map((reservation) => reservation.id),
          reservationCodes: visibleReservations.map((reservation) => reservation.reservationCode),
          laboratoryRoomCodes: [...new Set(visibleReservations.map((reservation) => reservation.laboratory.roomCode))]
        },
        affectedCount: visibleReservations.length,
        title: reviewStatus === "APPROVED" ? "Bulk reservation approval" : "Bulk reservation rejection",
        summary: `${reviewStatus === "APPROVED" ? "Approve" : "Reject"} ${visibleReservations.length} pending reservation${visibleReservations.length === 1 ? "" : "s"} for ${intent.laboratory?.roomCode ?? intent.range.label}.`,
        warnings: [
          reviewStatus === "APPROVED"
            ? "Each reservation will be rechecked before approval in case a conflict already exists."
            : "Students affected by the rejection will receive the normal reservation update flow if notifications are available.",
          remarks ? `Reason to record: ${remarks}` : "No rejection reason was included in the command."
        ],
        requiredConfirmationLevel: "HIGH",
        confirmationPhrase: `CONFIRM ${reviewStatus === "APPROVED" ? "APPROVE" : "REJECT"} ${visibleReservations.length} RESERVATIONS`,
        language: intent.language,
        payload: {
          kind: "review-reservations",
          reservationIds: visibleReservations.map((reservation) => reservation.id),
          reviewStatus,
          remarks
        }
      });

      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I prepared the bulk review draft. Please review the affected count and warnings, then type the required confirmation phrase to continue.",
            tagalog: "Naihanda ko na ang bulk review draft. Pakisuri ang affected count at warnings, tapos i-type ang required confirmation phrase para magpatuloy.",
            taglish: "Prepared na ang bulk review draft. Paki-review ang affected count at warnings, tapos i-type ang required confirmation phrase para mag-continue."
          }),
          category: "action_preview",
          suggestions: this.confirmationSuggestions(action),
          pendingAction: this.toPendingActionCard(action)
        },
        query: intent.previousQuery
      };
    }

    const reservationCode = this.extractReservationCode(intent.normalizedMessage);
    const requestedTime = this.extractTimeRange(intent.normalizedMessage)?.startTime;
    const candidates = visibleReservations.filter((reservation) => {
      if (reservationCode && reservation.reservationCode !== reservationCode) {
        return false;
      }

      if (requestedTime && reservation.startTime !== requestedTime) {
        return false;
      }

      return true;
    });

    if (candidates.length !== 1) {
      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I need one exact pending reservation to review. Please give me the reservation code, exact time, or a narrower laboratory/date filter.",
            tagalog: "Kailangan ko ng isang eksaktong pending reservation para ma-review ito. Pakibigay ang reservation code, eksaktong oras, o mas makitid na laboratory/date filter.",
            taglish: "Kailangan ko ng isang exact pending reservation para ma-review ito. Pakibigay ang reservation code, exact time, or mas narrow na laboratory/date filter."
          }),
          category: "clarification",
          suggestions: visibleReservations.slice(0, 3).map(
            (reservation) =>
              `${reviewStatus === "APPROVED" ? "Approve" : "Reject"} ${reservation.reservationCode}`
          )
        },
        query: intent.previousQuery
      };
    }

    const target = candidates[0];
    const action = this.storePendingAction(currentUser, {
      actionId: randomUUID(),
      actionType:
        reviewStatus === "APPROVED" ? "APPROVE_RESERVATION" : "REJECT_RESERVATION",
      requestedByUserId: currentUser.id,
      requestedByRole: currentUser.role,
      sessionId: currentUser.sessionId,
      targetRecords: {
        reservationIds: [target.id],
        reservationCodes: [target.reservationCode],
        laboratoryRoomCodes: [target.laboratory.roomCode]
      },
      affectedCount: 1,
      title: reviewStatus === "APPROVED" ? "Reservation approval" : "Reservation rejection",
      summary: `${reviewStatus === "APPROVED" ? "Approve" : "Reject"} ${target.reservationCode} for ${target.laboratory.roomCode} on ${dayjs(target.reservationDate).format("YYYY-MM-DD")} from ${target.startTime} to ${target.endTime}.`,
      warnings: remarks ? [`Reason to record: ${remarks}`] : [],
      requiredConfirmationLevel: "MEDIUM",
      confirmationPhrase: null,
      language: intent.language,
      payload: {
        kind: "review-reservations",
        reservationIds: [target.id],
        reviewStatus,
        remarks
      }
    });

    return {
      response: {
        reply: this.pick(intent.language, {
          english: "I prepared the reservation review draft. Confirm it when you're ready.",
          tagalog: "Naihanda ko na ang reservation review draft. I-confirm mo ito kapag handa ka na.",
          taglish: "Prepared na ang reservation review draft. Confirm mo ito kapag ready ka na."
        }),
        category: "action_preview",
        suggestions: this.confirmationSuggestions(action),
        pendingAction: this.toPendingActionCard(action)
      },
      query: intent.previousQuery
    };
  }

  private async draftScheduleCreation(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>
  ): Promise<HandledResponse> {
    if (currentUser.role === "STUDENT") {
      return this.permissionDeniedResponse(
        currentUser,
        intent.language,
        "Students are not allowed to create schedules."
      );
    }

    const timeRange = this.extractTimeRange(intent.normalizedMessage);

    if (!timeRange) {
      this.rememberScheduleFlow(currentUser, intent, {
        range: intent.range,
        laboratory: intent.laboratory,
        timeRange: null,
        useAllActiveLabs: intent.normalizedMessage.includes("all active labs"),
        lastQuestionAsked: "What start and end time should I use for the schedule?"
      });

      return this.clarificationResponse(
        currentUser,
        intent.language,
        "What start and end time should I use for the schedule? For example: 08:00 to 17:00.",
        intent
      );
    }

    const targetLaboratories = await this.resolveScheduleTargetLaboratories(currentUser, intent);

    if (targetLaboratories.kind === "denied") {
      return this.permissionDeniedResponse(currentUser, intent.language, targetLaboratories.message);
    }

    if (targetLaboratories.kind === "clarify") {
      this.rememberScheduleFlow(currentUser, intent, {
        range: intent.range,
        laboratory: intent.laboratory,
        timeRange,
        useAllActiveLabs: false,
        lastQuestionAsked: targetLaboratories.message
      });

      return this.clarificationResponse(currentUser, intent.language, targetLaboratories.message, intent);
    }

    const dates = this.collectScheduleDates(intent.range, intent.normalizedMessage);

    if (!dates.length) {
      return this.clarificationResponse(
        currentUser,
        intent.language,
        "I couldn't determine which date or weekdays to use for the schedule draft yet.",
        intent
      );
    }

    const entries = targetLaboratories.laboratories.flatMap((laboratory) =>
      dates.map(
        (date): ScheduleDraftEntry => ({
          laboratoryId: laboratory.id,
          laboratoryName: laboratory.name,
          roomCode: laboratory.roomCode,
          date,
          startTime: timeRange.startTime,
          endTime: timeRange.endTime,
          status: "AVAILABLE"
        })
      )
    );

    const existingSchedules = await this.db.schedule.findMany({
      where: {
        laboratoryId: {
          in: [...new Set(entries.map((entry) => entry.laboratoryId))]
        },
        date: {
          in: [...new Set(entries.map((entry) => new Date(`${entry.date}T00:00:00.000Z`)))]
        }
      },
      select: {
        laboratoryId: true,
        date: true,
        startTime: true,
        endTime: true
      }
    });

    const validEntries: ScheduleDraftEntry[] = [];
    const warnings: string[] = [];

    for (const entry of entries) {
      const hasConflict = existingSchedules.some(
        (schedule) =>
          schedule.laboratoryId === entry.laboratoryId &&
          dayjs(schedule.date).format("YYYY-MM-DD") === entry.date &&
          this.timeRangesOverlap(schedule.startTime, schedule.endTime, entry.startTime, entry.endTime)
      );

      if (hasConflict) {
        warnings.push(`${entry.roomCode} already has an overlapping schedule on ${entry.date}.`);
        continue;
      }

      validEntries.push(entry);
    }

    if (!validEntries.length) {
      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I couldn't prepare any new schedule records because every requested slot already conflicts with an existing schedule.",
            tagalog: "Wala akong naihandang bagong schedule records dahil lahat ng hiniling na slot ay may conflict na sa existing schedules.",
            taglish: "Wala akong naihandang bagong schedule records dahil lahat ng requested slots may conflict na sa existing schedules."
          }),
          category: "clarification",
          suggestions: this.roleAwareSuggestions(currentUser.role, intent.language)
        },
        query: intent.previousQuery
      };
    }

    const uniqueRoomCodes = [...new Set(validEntries.map((entry) => entry.roomCode))];
    const action = this.storePendingAction(currentUser, {
      actionId: randomUUID(),
      actionType: validEntries.length === 1 ? "CREATE_SCHEDULE" : "CREATE_BULK_SCHEDULE",
      requestedByUserId: currentUser.id,
      requestedByRole: currentUser.role,
      sessionId: currentUser.sessionId,
      targetRecords: {
        laboratoryIds: [...new Set(validEntries.map((entry) => entry.laboratoryId))],
        laboratoryRoomCodes: uniqueRoomCodes,
        scheduleKeys: validEntries.map(
          (entry) => `${entry.roomCode}:${entry.date}:${entry.startTime}-${entry.endTime}`
        )
      },
      affectedCount: validEntries.length,
      title: validEntries.length === 1 ? "Schedule creation" : "Bulk schedule creation",
      summary: `${validEntries.length} schedule record${validEntries.length === 1 ? "" : "s"} for ${uniqueRoomCodes.join(", ")} from ${timeRange.startTime} to ${timeRange.endTime} across ${dates.length} date${dates.length === 1 ? "" : "s"}.`,
      warnings,
      requiredConfirmationLevel: this.resolveScheduleConfirmationLevel(
        validEntries,
        targetLaboratories.usedAllActiveLabs
      ),
      confirmationPhrase:
        this.resolveScheduleConfirmationLevel(validEntries, targetLaboratories.usedAllActiveLabs) === "HIGH"
          ? "CONFIRM CREATE BULK SCHEDULES"
          : null,
      language: intent.language,
      payload: {
        kind: "create-schedules",
        entries: validEntries
      }
    });

    return {
      response: {
        reply: this.pick(intent.language, {
          english:
            action.requiredConfirmationLevel === "HIGH"
              ? "I prepared the bulk schedule draft. Please review the count and warnings, then type the required confirmation phrase to continue."
              : "I prepared the schedule draft. Review the summary below, then confirm when you're ready.",
          tagalog:
            action.requiredConfirmationLevel === "HIGH"
              ? "Naihanda ko na ang bulk schedule draft. Pakisuri ang count at warnings, tapos i-type ang required confirmation phrase para magpatuloy."
              : "Naihanda ko na ang schedule draft. Suriin ang summary sa ibaba, tapos i-confirm kapag handa ka na.",
          taglish:
            action.requiredConfirmationLevel === "HIGH"
              ? "Prepared na ang bulk schedule draft. Paki-review ang count at warnings, tapos i-type ang required confirmation phrase para magpatuloy."
              : "Prepared na ang schedule draft. Review ang summary sa ibaba, tapos confirm kapag ready ka na."
        }),
        category: "action_preview",
        suggestions: this.confirmationSuggestions(action),
        pendingAction: this.toPendingActionCard(action)
      },
      query: intent.previousQuery
    };
  }

  private rememberScheduleFlow(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    input: {
      range: ReturnType<IntentDetector["detect"]>["range"];
      laboratory: LaboratorySummary | null;
      timeRange: ParsedTimeRange | null;
      useAllActiveLabs: boolean;
      lastQuestionAsked: string;
    }
  ) {
    const missingSlots = [
      !input.timeRange ? "time range" : null,
      !input.laboratory && !input.useAllActiveLabs && currentUser.role === "ADMIN"
        ? "laboratory target"
        : null
    ].filter((slot): slot is string => Boolean(slot));

    contextManager.setActiveFlow(currentUser.id, currentUser.sessionId, {
      activeIntent: input.useAllActiveLabs ? "CREATE_BULK_SCHEDULE_DRAFT" : "CREATE_SCHEDULE_DRAFT",
      activeFlow: "slot_collection",
      collectedSlots: {
        range: input.range,
        laboratoryId: input.laboratory?.id ?? null,
        timeRange: input.timeRange,
        useAllActiveLabs: input.useAllActiveLabs,
        language: intent.language
      },
      missingSlots,
      lastQuestionAsked: input.lastQuestionAsked,
      lastShownOptions:
        currentUser.role === "ADMIN"
          ? ["all active labs", "specific lab room code"]
          : ["my assigned laboratory"],
      pendingDraftAction: null,
      confirmationRequired: false
    });
  }

  private startGuidedReservationFlowResponse(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    input: {
      range?: ReturnType<IntentDetector["detect"]>["range"];
      timeRange?: ParsedTimeRange | null;
      purpose?: string | null;
      question: string;
    }
  ): HandledResponse {
    this.rememberGuidedReservationFlow(currentUser, intent, {
      currentStep: "select_laboratory",
      filledSlots: {
        ...(input.range ? { range: input.range } : {}),
        ...(input.timeRange ? { timeRange: input.timeRange } : {}),
        ...(input.purpose ? { purpose: input.purpose } : {})
      },
      missingSlots: ["laboratory", "date", "schedule"],
      lastQuestionAsked: "Which laboratory would you like to reserve?"
    });

    return this.clarificationResponse(currentUser, intent.language, input.question, intent);
  }

  private rememberGuidedReservationFlow(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    input: {
      currentStep: string;
      filledSlots: Record<string, unknown>;
      missingSlots: string[];
      lastQuestionAsked: string;
    }
  ) {
    contextManager.setActiveFlow(currentUser.id, currentUser.sessionId, {
      activeIntent: "CREATE_RESERVATION_DRAFT",
      activeFlow: "GUIDED_RESERVATION_FLOW",
      currentStep: input.currentStep,
      filledSlots: input.filledSlots,
      collectedSlots: input.filledSlots,
      missingSlots: input.missingSlots,
      lastQuestionAsked: input.lastQuestionAsked,
      lastShownOptions: ["CL-302", "show available labs"],
      pendingDraftAction: null,
      confirmationRequired: false
    });
    this.logAssistantActiveFlow("saved", "GUIDED_RESERVATION_FLOW");
  }

  private buildReservationGuideReply(role: CurrentUser["role"]) {
    const roleNote =
      role === "ADMIN" || role === "LABORATORY_STAFF"
        ? "\n\nSince your role is Admin/Lab Staff, you may also manage schedules and reservation approvals depending on your permissions."
        : "";

    return `Sure! Here is the step-by-step guide to reserve a laboratory in ComPort:

Step 1: Choose a laboratory.
Step 2: Choose your preferred date.
Step 3: Select an available schedule or time block.
Step 4: Enter your purpose or subject if required.
Step 5: Review the reservation preview.
Step 6: Confirm and submit your reservation request.
Step 7: Wait for approval from the authorized laboratory staff or admin.${roleNote}

I can guide you now. Which laboratory would you like to reserve? You can type a room code like CL-302 or say 'show available labs'.`;
  }

  private async draftLaboratoryManagement(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    _authenticatedUserContext: CurrentUserContextResult | null
  ): Promise<HandledResponse> {
    if (currentUser.role !== "ADMIN") {
      return this.permissionDeniedResponse(
        currentUser,
        intent.language,
        "Only admin accounts can manage laboratories through the assistant."
      );
    }

    const message = intent.normalizedMessage;
    const roomCode = this.extractRoomCode(message) ?? intent.laboratory?.roomCode ?? null;
    const matchedLab =
      intent.laboratory ??
      (roomCode
        ? (await this.tools.listLaboratories()).find((laboratory) => laboratory.roomCode === roomCode) ?? null
        : null);

    if ((message.includes("remove") || message.includes("tanggal")) && !message.includes("delete")) {
      if (!matchedLab) {
        return this.clarificationResponse(
          currentUser,
          intent.language,
          "Which laboratory should I remove from active use? Give me a room code like CL-305.",
          intent
        );
      }

      return this.prepareLaboratoryStatusDraft(
        currentUser,
        intent,
        matchedLab.id,
        "UNAVAILABLE",
        "Remove laboratory from active use",
        "DEACTIVATE_LABORATORY"
      );
    }

    if (message.includes("maintenance") || message.includes("under maintenance")) {
      if (!matchedLab) {
        return this.clarificationResponse(
          currentUser,
          intent.language,
          "Which laboratory should I mark as under maintenance?",
          intent
        );
      }

      return this.prepareLaboratoryStatusDraft(
        currentUser,
        intent,
        matchedLab.id,
        "MAINTENANCE",
        "Mark laboratory under maintenance",
        "UPDATE_LABORATORY"
      );
    }

    if (message.includes("deactivate") || message.includes("inactive")) {
      if (!matchedLab) {
        return this.clarificationResponse(
          currentUser,
          intent.language,
          "Which laboratory should I deactivate?",
          intent
        );
      }

      return this.prepareLaboratoryStatusDraft(
        currentUser,
        intent,
        matchedLab.id,
        "UNAVAILABLE",
        "Deactivate laboratory",
        "DEACTIVATE_LABORATORY"
      );
    }

    if (message.includes("delete")) {
      if (!matchedLab) {
        return this.clarificationResponse(
          currentUser,
          intent.language,
          "Which laboratory should I permanently delete?",
          intent
        );
      }

      const dependencies = await this.tools.getLaboratoryDependencies(matchedLab.id);

      if (
        dependencies.reservations > 0 ||
        dependencies.calendarEvents > 0 ||
        dependencies.schedules > 0 ||
        dependencies.activityLogs > 0
      ) {
        return {
          response: {
            reply: this.pick(intent.language, {
              english: `I can't safely delete ${matchedLab.roomCode} because it already has dependent records. I recommend deactivating it instead.`,
              tagalog: `Hindi ko ligtas na made-delete ang ${matchedLab.roomCode} dahil may mga dependent records na ito. Mas mainam na i-deactivate na lang ito.`,
              taglish: `Hindi ko ligtas na made-delete ang ${matchedLab.roomCode} dahil may dependent records na ito. Mas okay na i-deactivate na lang ito.`
            }),
            category: "clarification",
            suggestions: [`Deactivate ${matchedLab.roomCode}`]
          },
          query: intent.previousQuery
        };
      }

      const action = this.storePendingAction(currentUser, {
        actionId: randomUUID(),
        actionType: "DELETE_LABORATORY",
        requestedByUserId: currentUser.id,
        requestedByRole: currentUser.role,
        sessionId: currentUser.sessionId,
        targetRecords: {
          laboratoryIds: [matchedLab.id],
          laboratoryRoomCodes: [matchedLab.roomCode]
        },
        affectedCount: 1,
        title: "Delete laboratory",
        summary: `Permanently delete ${matchedLab.roomCode} - ${matchedLab.name}.`,
        warnings: ["This permanently removes the laboratory record because no history dependencies were found."],
        requiredConfirmationLevel: "HIGH",
        confirmationPhrase: `CONFIRM DELETE ${matchedLab.roomCode}`,
        language: intent.language,
        payload: {
          kind: "delete-laboratory",
          laboratoryId: matchedLab.id
        }
      });

      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I prepared the laboratory deletion draft. Please type the required confirmation phrase if you want me to continue.",
            tagalog: "Naihanda ko na ang laboratory deletion draft. Paki-type ang required confirmation phrase kung gusto mong ituloy ko ito.",
            taglish: "Prepared na ang laboratory deletion draft. Paki-type ang required confirmation phrase kung gusto mong ituloy ko ito."
          }),
          category: "action_preview",
          suggestions: this.confirmationSuggestions(action),
          pendingAction: this.toPendingActionCard(action)
        },
        query: intent.previousQuery
      };
    }

    if (message.includes("update")) {
      if (!matchedLab) {
        return this.clarificationResponse(
          currentUser,
          intent.language,
          "Which laboratory should I update?",
          intent
        );
      }

      const record = await this.db.laboratory.findUnique({
        where: { id: matchedLab.id }
      });

      if (!record) {
        return this.clarificationResponse(
          currentUser,
          intent.language,
          `I couldn't load the full record for ${matchedLab.roomCode} right now.`,
          intent
        );
      }

      const capacity = this.extractCapacity(message) ?? record.capacity;
      const computerCount = this.extractComputerCount(message) ?? record.computerCount;
      const action = this.storePendingAction(currentUser, {
        actionId: randomUUID(),
        actionType: "UPDATE_LABORATORY",
        requestedByUserId: currentUser.id,
        requestedByRole: currentUser.role,
        sessionId: currentUser.sessionId,
        targetRecords: {
          laboratoryIds: [record.id],
          laboratoryRoomCodes: [record.roomCode]
        },
        affectedCount: 1,
        title: "Update laboratory",
        summary: `Update ${record.roomCode} with capacity ${capacity} and computer count ${computerCount}.`,
        warnings: [],
        requiredConfirmationLevel: "MEDIUM",
        confirmationPhrase: null,
        language: intent.language,
        payload: {
          kind: "update-laboratory",
          laboratoryId: record.id,
          input: {
            name: record.name,
            roomCode: record.roomCode,
            building: record.building,
            location: record.location ?? undefined,
            capacity,
            computerCount,
            description: record.description,
            status: record.status,
            imageUrl: record.imageUrl ?? undefined,
            custodianId: record.custodianId ?? null
          }
        }
      });

      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I prepared the laboratory update draft. Confirm it when you're ready.",
            tagalog: "Naihanda ko na ang laboratory update draft. I-confirm mo ito kapag handa ka na.",
            taglish: "Prepared na ang laboratory update draft. Confirm mo ito kapag ready ka na."
          }),
          category: "action_preview",
          suggestions: this.confirmationSuggestions(action),
          pendingAction: this.toPendingActionCard(action)
        },
        query: intent.previousQuery
      };
    }

    if (message.includes("add laboratory") || message.includes("create lab") || message.includes("add lab")) {
      const roomCodeValue = roomCode;
      const capacity = this.extractCapacity(message);
      const computerCount = this.extractComputerCount(message);
      const name = this.extractLaboratoryName(message);
      const building = this.extractBuilding(message);
      const description = this.extractDescription(message);

      const missingFields = [
        !name ? "laboratory name" : null,
        !roomCodeValue ? "room code" : null,
        !building ? "building" : null,
        !capacity ? "capacity" : null,
        !computerCount ? "computer count" : null,
        !description ? "description" : null
      ].filter(Boolean);

      if (missingFields.length) {
        const nextMissingField = missingFields[0];
        return this.clarificationResponse(
          currentUser,
          intent.language,
          `I can prepare that laboratory creation draft. What ${nextMissingField} should I use?`,
          intent
        );
      }

      const action = this.storePendingAction(currentUser, {
        actionId: randomUUID(),
        actionType: "CREATE_LABORATORY",
        requestedByUserId: currentUser.id,
        requestedByRole: currentUser.role,
        sessionId: currentUser.sessionId,
        targetRecords: {
          laboratoryRoomCodes: [roomCodeValue!]
        },
        affectedCount: 1,
        title: "Create laboratory",
        summary: `Create ${roomCodeValue} - ${name} in ${building} with capacity ${capacity} and ${computerCount} computers.`,
        warnings: [],
        requiredConfirmationLevel: "MEDIUM",
        confirmationPhrase: null,
        language: intent.language,
        payload: {
          kind: "create-laboratory",
          input: {
            name: name!,
            roomCode: roomCodeValue!,
            building: building!,
            location: `${building!} - ${roomCodeValue!}`,
            capacity: capacity!,
            computerCount: computerCount!,
            description: description!,
            status: "AVAILABLE"
          }
        }
      });

      return {
        response: {
          reply: this.pick(intent.language, {
            english: "I prepared the laboratory creation draft. Confirm it when you're ready.",
            tagalog: "Naihanda ko na ang laboratory creation draft. I-confirm mo ito kapag handa ka na.",
            taglish: "Prepared na ang laboratory creation draft. Confirm mo ito kapag ready ka na."
          }),
          category: "action_preview",
          suggestions: this.confirmationSuggestions(action),
          pendingAction: this.toPendingActionCard(action)
        },
        query: intent.previousQuery
      };
    }

    return this.clarificationResponse(
      currentUser,
      intent.language,
      "I can help with create, update, deactivate, maintenance, or delete laboratory actions, but I still need a clearer laboratory command.",
      intent
    );
  }

  private async prepareLaboratoryStatusDraft(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    laboratoryId: number,
    status: LaboratoryStatus,
    title: string,
    actionType: Extract<AssistantActionType, "UPDATE_LABORATORY" | "DEACTIVATE_LABORATORY">
  ): Promise<HandledResponse> {
    const record = await this.db.laboratory.findUnique({
      where: { id: laboratoryId }
    });

    if (!record) {
      return this.clarificationResponse(
        currentUser,
        intent.language,
        "I couldn't load that laboratory record right now.",
        intent
      );
    }

    const action = this.storePendingAction(currentUser, {
      actionId: randomUUID(),
      actionType,
      requestedByUserId: currentUser.id,
      requestedByRole: currentUser.role,
      sessionId: currentUser.sessionId,
      targetRecords: {
        laboratoryIds: [record.id],
        laboratoryRoomCodes: [record.roomCode]
      },
      affectedCount: 1,
      title,
      summary: `${status === "MAINTENANCE" ? "Mark" : "Set"} ${record.roomCode} to ${status.toLowerCase()}.`,
      warnings: [
        "This changes the laboratory status for future reservation availability checks."
      ],
      requiredConfirmationLevel: "HIGH",
      confirmationPhrase:
        actionType === "DEACTIVATE_LABORATORY"
          ? "CONFIRM REMOVE LABORATORY"
          : `CONFIRM UPDATE ${record.roomCode}`,
      language: intent.language,
      payload: {
        kind: "update-laboratory",
        laboratoryId: record.id,
        input: {
          name: record.name,
          roomCode: record.roomCode,
          building: record.building,
          location: record.location ?? undefined,
          capacity: record.capacity,
          computerCount: record.computerCount,
          description: record.description,
          status,
          imageUrl: record.imageUrl ?? undefined,
          custodianId: record.custodianId ?? null
        }
      }
    });

    return {
      response: {
        reply: this.pick(intent.language, {
          english: "I prepared the laboratory status draft. Please type the required confirmation phrase if you want me to continue.",
          tagalog: "Naihanda ko na ang laboratory status draft. Paki-type ang required confirmation phrase kung gusto mong ituloy ko ito.",
          taglish: "Prepared na ang laboratory status draft. Paki-type ang required confirmation phrase kung gusto mong ituloy ko ito."
        }),
        category: "action_preview",
        suggestions: this.confirmationSuggestions(action),
        pendingAction: this.toPendingActionCard(action)
      },
      query: intent.previousQuery
    };
  }

  private async executePendingAction(
    currentUser: CurrentUser,
    action: AssistantPendingActionRecord
  ): Promise<Omit<ReservationAssistantResponse, "mode">> {
    switch (action.payload.kind) {
      case "create-reservation": {
        const reservation = await this.reservationService.createReservation(
          action.payload.input,
          currentUser.id
        );

        return {
          reply: this.pick(action.language, {
            english: `Done. I submitted reservation ${reservation.reservationCode} for ${reservation.laboratory?.roomCode ?? "the selected laboratory"}.`,
            tagalog: `Tapos na. Naipasa ko na ang reservation ${reservation.reservationCode} para sa ${reservation.laboratory?.roomCode ?? "napiling laboratoryo"}.`,
            taglish: `Done na. Na-submit ko na ang reservation ${reservation.reservationCode} for ${reservation.laboratory?.roomCode ?? "selected laboratory"}.`
          }),
          category: "action_completed",
          suggestions: this.roleAwareSuggestions(currentUser.role, action.language),
          presentation: {
            type: "summary",
            title: this.pick(action.language, {
              english: "Reservation submitted",
              tagalog: "Reservation submitted",
              taglish: "Reservation submitted"
            }),
            items: [
              { label: "Reservation code", value: reservation.reservationCode },
              {
                label: "Status",
                value: reservation.status
              }
            ]
          }
        };
      }
      case "cancel-reservation": {
        const reservation = await this.reservationService.cancelReservation(
          action.payload.reservationId,
          currentUser.id
        );

        return {
          reply: this.pick(action.language, {
            english: `Done. Reservation ${reservation.reservationCode} was cancelled.`,
            tagalog: `Tapos na. Nakansela na ang reservation ${reservation.reservationCode}.`,
            taglish: `Done na. Na-cancel na ang reservation ${reservation.reservationCode}.`
          }),
          category: "action_completed",
          suggestions: this.roleAwareSuggestions(currentUser.role, action.language)
        };
      }
      case "review-reservations": {
        const completed: string[] = [];
        const skipped: string[] = [];

        for (const reservationId of action.payload.reservationIds) {
          try {
            const reservation = await this.reservationService.reviewReservation(
              reservationId,
              {
                status: action.payload.reviewStatus,
                remarks: action.payload.remarks ?? undefined
              },
              currentUser
            );
            completed.push(reservation.reservationCode);
          } catch (error) {
            skipped.push(error instanceof Error ? error.message : `Reservation ${reservationId} failed.`);
          }
        }

        return {
          reply: this.pick(action.language, {
            english: `Done. ${completed.length} reservation${completed.length === 1 ? "" : "s"} ${action.payload.reviewStatus === "APPROVED" ? "approved" : "rejected"}${skipped.length ? `, with ${skipped.length} skipped` : ""}.`,
            tagalog: `Tapos na. ${completed.length} reservation${completed.length === 1 ? "" : "s"} ang ${action.payload.reviewStatus === "APPROVED" ? "na-approve" : "na-reject"}${skipped.length ? `, at may ${skipped.length} na-skip` : ""}.`,
            taglish: `Done na. ${completed.length} reservation${completed.length === 1 ? "" : "s"} ang ${action.payload.reviewStatus === "APPROVED" ? "na-approve" : "na-reject"}${skipped.length ? `, with ${skipped.length} skipped` : ""}.`
          }),
          category: "action_completed",
          suggestions: this.roleAwareSuggestions(currentUser.role, action.language),
          presentation: {
            type: "summary",
            title: this.pick(action.language, {
              english: "Reservation review result",
              tagalog: "Reservation review result",
              taglish: "Reservation review result"
            }),
            items: [
              { label: "Updated", value: String(completed.length) },
              { label: "Skipped", value: String(skipped.length) }
            ],
            notes: skipped.length ? skipped.slice(0, 5) : undefined
          }
        };
      }
      case "create-schedules": {
        const created: string[] = [];
        const skipped: string[] = [];

        for (const entry of action.payload.entries) {
          try {
            await this.scheduleService.createSchedule(
              {
                laboratoryId: entry.laboratoryId,
                date: entry.date,
                startTime: entry.startTime,
                endTime: entry.endTime,
                status: entry.status
              },
              currentUser
            );
            created.push(`${entry.roomCode} ${entry.date}`);
          } catch (error) {
            skipped.push(error instanceof Error ? error.message : `Schedule for ${entry.roomCode} failed.`);
          }
        }

        return {
          reply: this.pick(action.language, {
            english: `Done. I created ${created.length} schedule record${created.length === 1 ? "" : "s"}${skipped.length ? ` and skipped ${skipped.length}` : ""}.`,
            tagalog: `Tapos na. Gumawa ako ng ${created.length} schedule record${created.length === 1 ? "" : "s"}${skipped.length ? ` at may ${skipped.length} na-skip` : ""}.`,
            taglish: `Done na. Gumawa ako ng ${created.length} schedule record${created.length === 1 ? "" : "s"}${skipped.length ? ` and skipped ${skipped.length}` : ""}.`
          }),
          category: "action_completed",
          suggestions: this.roleAwareSuggestions(currentUser.role, action.language),
          presentation: {
            type: "summary",
            title: this.pick(action.language, {
              english: "Schedule creation result",
              tagalog: "Schedule creation result",
              taglish: "Schedule creation result"
            }),
            items: [
              { label: "Created", value: String(created.length) },
              { label: "Skipped", value: String(skipped.length) }
            ],
            notes: skipped.length ? skipped.slice(0, 5) : undefined
          }
        };
      }
      case "update-laboratory": {
        const laboratory = await this.laboratoryService.updateLaboratory(
          action.payload.laboratoryId,
          action.payload.input,
          currentUser.id
        );

        return {
          reply: this.pick(action.language, {
            english: `Done. ${laboratory.roomCode} is now set to ${laboratory.status.toLowerCase()}.`,
            tagalog: `Tapos na. Ang ${laboratory.roomCode} ay naka-set na ngayon sa ${laboratory.status.toLowerCase()}.`,
            taglish: `Done na. Ang ${laboratory.roomCode} is now set to ${laboratory.status.toLowerCase()}.`
          }),
          category: "action_completed",
          suggestions: this.roleAwareSuggestions(currentUser.role, action.language)
        };
      }
      case "create-laboratory": {
        const laboratory = await this.laboratoryService.createLaboratory(
          action.payload.input,
          currentUser.id
        );

        return {
          reply: this.pick(action.language, {
            english: `Done. I created laboratory ${laboratory.roomCode} - ${laboratory.name}.`,
            tagalog: `Tapos na. Nalikha ko na ang laboratory ${laboratory.roomCode} - ${laboratory.name}.`,
            taglish: `Done na. Nalikha ko na ang laboratory ${laboratory.roomCode} - ${laboratory.name}.`
          }),
          category: "action_completed",
          suggestions: this.roleAwareSuggestions(currentUser.role, action.language)
        };
      }
      case "delete-laboratory": {
        await this.laboratoryService.deleteLaboratory(action.payload.laboratoryId, currentUser.id);

        return {
          reply: this.pick(action.language, {
            english: "Done. The laboratory record was permanently deleted.",
            tagalog: "Tapos na. Permanenteng na-delete ang laboratory record.",
            taglish: "Done na. Permanently na-delete ang laboratory record."
          }),
          category: "action_completed",
          suggestions: this.roleAwareSuggestions(currentUser.role, action.language)
        };
      }
    }
  }

  private async buildLegacyResponse(
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
            suggestions: this.roleAwareSuggestions(currentUser.role, intent.language)
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
      const helpContext = await this.tools.getGeneralHelpContext(intent.range);
      const response = this.responseFormatter.formatGeneralHelp(intent.language, helpContext);
      return {
        response,
        aiContext: JSON.stringify(helpContext, null, 2)
      };
    }

    if (intent.category === "system_info") {
      const systemInfo = await this.tools.getSystemInfo();
      const response = this.responseFormatter.formatSystemInfo(intent.language, systemInfo);
      return {
        response,
        aiContext: JSON.stringify(systemInfo, null, 2)
      };
    }

    if (intent.category === "reservation_rules") {
      const rules = await this.tools.getRules();
      const response = this.responseFormatter.formatRules(intent.language, rules);
      return {
        response,
        aiContext: JSON.stringify({ reservationRules: rules }, null, 2)
      };
    }

    if (intent.category === "notifications") {
      const notifications = await this.tools.getNotificationsForCurrentUser(currentUser, {
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
      const reservationContext = await this.tools.getReservationsForCurrentUser(currentUser, intent.range, {
        latestOnly,
        upcomingOnly,
        statuses,
        orderBy: latestOnly ? "desc" : "asc",
        take: latestOnly ? 1 : 12
      });
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
      const stats = await this.tools.getSystemStatsForRole(currentUser);

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
      const queue = await this.tools.getPendingReservations(currentUser, intent.range, {
        laboratoryId: intent.laboratory?.id,
        limit: 8
      });

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
            suggestions: [
              "Who submitted the latest reservation?",
              "Which reservations need approval?"
            ]
          },
          aiContext: "Reservation submitter lookup needs either an explicit reservation code or the latest-reservation scope."
        };
      }

      const reservation = await this.tools.getReservationByIdOrReference(currentUser, {
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
            suggestions: [
              "Who submitted the latest reservation?",
              "Which reservations need approval?"
            ]
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
      const activity = await this.tools.getActivityLogsForRole(currentUser, { limit: 8 });

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
      const directory = await this.tools.getStaffDirectory(currentUser, { limit: 12 });

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
      const laboratoryContext = await this.tools.getLaboratoryLookup(intent.laboratory);
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
        const suggestions = await this.tools.getLaboratorySuggestions();
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
      const scheduleContext = await this.tools.getScheduleAvailability(intent.range, {
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
      const laboratoryContext = await this.tools.getLaboratoryAvailability(intent.range, {
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
    const scheduleContext = await this.tools.getScheduleAvailability(intent.range, {
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
        "reservation_guide",
        "reservation_rules",
        "general_reservation_help",
        "role_capabilities",
        "usage_analytics",
        "clarification",
        "permission_denied",
        "action_preview",
        "action_completed",
        "action_cancelled"
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

  private finalizeResponse(
    currentUser: CurrentUser,
    response: Omit<ReservationAssistantResponse, "mode">,
    query: AssistantQuerySnapshot | null
  ): ReservationAssistantResponse {
    contextManager.appendAssistantMessage(
      currentUser.id,
      currentUser.sessionId,
      response.reply,
      response.category,
      query
    );
    this.logAssistantActiveFlow(
      "after",
      contextManager.get(currentUser.id, currentUser.sessionId)?.activeFlow?.activeFlow ?? null
    );

    return {
      ...response,
      mode: "fallback"
    };
  }

  private logAssistantRoute(
    normalizedMessage: string,
    detectedIntent: AssistantCategory,
    routeSource: "rule-based" | "model",
    activeFlowBefore: string | null,
    activeFlowAfter: string | null
  ) {
    if (env.NODE_ENV !== "development") {
      return;
    }

    console.info(`Assistant route: ${detectedIntent.toUpperCase()} via ${routeSource}`, {
      normalizedMessage,
      activeFlowBefore,
      activeFlowAfter
    });
  }

  private logAssistantActiveFlow(label: "saved" | "after", activeFlow: string | null) {
    if (env.NODE_ENV !== "development") {
      return;
    }

    console.info(`Assistant active flow ${label}: ${activeFlow ?? "none"}`);
  }

  private buildSimpleQuerySnapshot(
    category: AssistantCategory,
    intent: ReturnType<IntentDetector["detect"]>
  ): AssistantQuerySnapshot {
    return {
      category,
      range: intent.range,
      laboratory: intent.laboratory,
      language: intent.language,
      resultOffset: 0,
      hasMore: false
    };
  }

  private storePendingAction(
    currentUser: CurrentUser,
    record: Omit<AssistantPendingActionRecord, "expiresAt">
  ) {
    const previousActionId = contextManager.getPendingActionId(currentUser.id, currentUser.sessionId);

    if (previousActionId) {
      pendingActionStore.delete(previousActionId);
    }

    const action = pendingActionStore.create(record);
    contextManager.setPendingActionId(currentUser.id, currentUser.sessionId, action.actionId);

    return action;
  }

  private toPendingActionCard(action: AssistantPendingActionRecord): AssistantPendingActionCard {
    return {
      actionId: action.actionId,
      actionType: action.actionType,
      title: action.title,
      summary: action.summary,
      affectedCount: action.affectedCount,
      warnings: action.warnings,
      requiredConfirmationLevel: action.requiredConfirmationLevel,
      confirmationPhrase: action.confirmationPhrase,
      expiresAt: new Date(action.expiresAt).toISOString()
    };
  }

  private confirmationSuggestions(action: AssistantPendingActionRecord) {
    if (action.requiredConfirmationLevel === "HIGH") {
      return action.confirmationPhrase ? [action.confirmationPhrase, "Cancel"] : ["Cancel"];
    }

    return ["Confirm", "Cancel"];
  }

  private validateConfirmation(
    action: AssistantPendingActionRecord,
    confirmationText?: string
  ) {
    if (action.requiredConfirmationLevel === "HIGH") {
      if (!action.confirmationPhrase) {
        return null;
      }

      if (confirmationText?.trim().toUpperCase() !== action.confirmationPhrase) {
        return this.pick(action.language, {
          english: `Please type the exact confirmation phrase: ${action.confirmationPhrase}`,
          tagalog: `Pakitype ang eksaktong confirmation phrase: ${action.confirmationPhrase}`,
          taglish: `Paki-type ang exact confirmation phrase: ${action.confirmationPhrase}`
        });
      }

      return null;
    }

    if (!confirmationText) {
      return null;
    }

    const normalized = normalizeAssistantText(confirmationText);

    if (action.requiredConfirmationLevel === "MEDIUM" && !normalized.startsWith("confirm") && !normalized.startsWith("proceed")) {
      return this.pick(action.language, {
        english: 'Please say "Confirm" or "Proceed" for this action.',
        tagalog: 'Pakisabi ang "Confirm" o "Proceed" para sa action na ito.',
        taglish: 'Paki-sabi ang "Confirm" or "Proceed" para sa action na ito.'
      });
    }

    if (action.requiredConfirmationLevel === "LOW" && !CONFIRM_SYNONYMS.has(normalized) && !normalized.startsWith("confirm")) {
      return this.pick(action.language, {
        english: 'Please confirm by saying "confirm", "yes", or "proceed".',
        tagalog: 'Paki-confirm gamit ang "confirm", "yes", o "proceed".',
        taglish: 'Paki-confirm gamit ang "confirm", "yes", or "proceed".'
      });
    }

    return null;
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
      const rewriteContext = {
        role: input.role,
        language: input.language,
        intent: input.intent,
        answerCanOnlyRestateVerifiedReply: true,
        sourceSummary: this.summarizeVerifiedContext(input.verifiedContext),
        userProfile:
          input.authenticatedUserContext === null
            ? null
            : {
                role: input.authenticatedUserContext.role,
                verificationStatus: input.authenticatedUserContext.verificationStatus
              }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: this.buildAiHeaders(),
        body: JSON.stringify({
          model: env.AI_MODEL,
          temperature: env.AI_TEMPERATURE,
          max_tokens: env.AI_MAX_TOKENS,
          messages: [
            {
              role: "system",
              content: COMPORT_GPT_SYSTEM_PROMPT
            },
            ...recentHistory,
            {
              role: "user",
              content: [
                `Latest user message: ${input.userMessage}`,
                `Rewrite constraints: ${JSON.stringify(rewriteContext, null, 2)}`,
                `Verified deterministic answer: ${input.verifiedReply}`,
                "Rewrite the verified deterministic answer into a warm, natural reply for the latest user message.",
                "Use only the verified deterministic answer as your factual source.",
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

  private shouldUseAiRewrite(category: ReservationAssistantResponse["category"]) {
    return ["general_reservation_help", "system_info", "reservation_rules", "out_of_scope"].includes(
      category
    );
  }

  private summarizeVerifiedContext(value: string) {
    if (!value) {
      return "No additional verified context provided.";
    }

    if (value.length <= 220) {
      return value;
    }

    return `${value.slice(0, 217)}...`;
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

  private extractReviewStatus(message: string): "APPROVED" | "REJECTED" | null {
    if (message.includes("approve")) {
      return "APPROVED";
    }

    if (message.includes("reject") || message.includes("tanggihan")) {
      return "REJECTED";
    }

    return null;
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

  private extractRoomCode(message: string) {
    const match = message.match(/\bcl[-\s]?\d{3}\b/i);

    if (!match) {
      return null;
    }

    const normalized = match[0].toUpperCase().replace(/\s+/g, "");
    return normalized.includes("-")
      ? normalized
      : `${normalized.slice(0, 2)}-${normalized.slice(2)}`;
  }

  private extractCapacity(message: string) {
    const match = message.match(/capacity(?:\s+to)?\s+(\d{1,3})|(\d{1,3})\s+capacity/);
    return match ? Number(match[1] ?? match[2]) : null;
  }

  private extractComputerCount(message: string) {
    const match = message.match(/computer(?:\s+count)?(?:\s+to)?\s+(\d{1,3})|(\d{1,3})\s+(?:pcs|computers?)/);
    return match ? Number(match[1] ?? match[2]) : null;
  }

  private extractLaboratoryName(message: string) {
    const match = message.match(/(?:create|add)\s+(?:laboratory|lab)\s+(.+?)\s+(?:code|room code)\s+cl[-\s]?\d{3}/);
    return match?.[1]?.trim() ?? null;
  }

  private extractBuilding(message: string) {
    const match = message.match(/building\s+([a-z0-9\s-]+)/);
    return match?.[1]?.trim() ?? null;
  }

  private extractDescription(message: string) {
    const match = message.match(/description\s+(.+)/);
    return match?.[1]?.trim() ?? null;
  }

  private extractPurpose(message: string) {
    const match = message.match(/(?:for|para sa)\s+(.+)/);
    return match?.[1]?.trim() ?? null;
  }

  private extractReason(message: string) {
    const match = message.match(/(?:because|dahil sa|dahil|kasi|reason)\s+(.+)/);
    return match?.[1]?.trim() ?? null;
  }

  private extractTimeRange(message: string): ParsedTimeRange | null {
    const match = message.match(
      /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|to|hanggang|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/
    );

    if (!match) {
      return null;
    }

    const start = this.toTimeString(
      Number(match[1]),
      match[2] ? Number(match[2]) : 0,
      match[3] ?? null,
      undefined
    );
    const startHours = Number.parseInt(start.slice(0, 2), 10);
    const end = this.toTimeString(
      Number(match[4]),
      match[5] ? Number(match[5]) : 0,
      match[6] ?? null,
      startHours
    );

    if (start >= end) {
      return null;
    }

    return {
      startTime: start,
      endTime: end
    };
  }

  private toTimeString(
    hours: number,
    minutes: number,
    meridiem: string | null,
    startHours?: number
  ) {
    let normalizedHours = hours;

    if (meridiem === "pm" && hours < 12) {
      normalizedHours = hours + 12;
    } else if (meridiem === "am" && hours === 12) {
      normalizedHours = 0;
    } else if (!meridiem && typeof startHours === "number" && hours <= startHours && hours < 12) {
      normalizedHours = hours + 12;
    }

    return `${String(normalizedHours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  }

  private collectScheduleDates(range: ReturnType<IntentDetector["detect"]>["range"], message: string) {
    const weekdays = this.extractWeekdayIndexes(message);
    const dates: string[] = [];
    let cursor = dayjs(range.start).startOf("day");
    const end = dayjs(range.end).startOf("day");

    while (cursor.isBefore(end) || cursor.isSame(end, "day")) {
      if (!weekdays.length || weekdays.includes(cursor.day())) {
        dates.push(cursor.format("YYYY-MM-DD"));
      }

      cursor = cursor.add(1, "day");
    }

    return dates;
  }

  private extractWeekdayIndexes(message: string) {
    if (
      message.includes("monday to friday") ||
      message.includes("lunes hanggang biyernes") ||
      message.includes("monday through friday")
    ) {
      return [1, 2, 3, 4, 5];
    }

    return [...new Set(Array.from(WEEKDAY_INDEX_BY_NAME.entries())
      .filter(([token]) => message.includes(token))
      .map(([, value]) => value))].sort();
  }

  private async resolveScheduleTargetLaboratories(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>
  ):
    Promise<
      | { kind: "ready"; laboratories: LaboratorySummary[]; usedAllActiveLabs: boolean }
      | { kind: "clarify"; message: string }
      | { kind: "denied"; message: string }
    > {
    if (intent.normalizedMessage.includes("all active labs")) {
      if (currentUser.role !== "ADMIN") {
        return {
          kind: "denied",
          message: "Only admins can create schedules for all active laboratories."
        };
      }

      return {
        kind: "ready",
        laboratories: (await this.tools.listLaboratories()).filter(
          (laboratory) => laboratory.status === "AVAILABLE"
        ),
        usedAllActiveLabs: true
      };
    }

    if (intent.laboratory) {
      return {
        kind: "ready",
        laboratories: [intent.laboratory],
        usedAllActiveLabs: false
      };
    }

    if (currentUser.role === "LABORATORY_STAFF") {
      const managed = await this.tools.getManagedLaboratories(currentUser);

      if (!managed.length) {
        return {
          kind: "denied",
          message: "No laboratory is assigned to your staff account yet."
        };
      }

      const laboratories = (await this.tools.listLaboratories()).filter((laboratory) =>
        managed.some((managedLaboratory) => managedLaboratory.id === laboratory.id)
      );

      return {
        kind: "ready",
        laboratories,
        usedAllActiveLabs: false
      };
    }

    return {
      kind: "clarify",
      message: "Which laboratory should I use for the schedule draft? You can name a room code like CL-302 or say all active labs."
    };
  }

  private resolveScheduleConfirmationLevel(
    entries: ScheduleDraftEntry[],
    usedAllActiveLabs: boolean
  ): AssistantConfirmationLevel {
    if (usedAllActiveLabs || entries.length >= 5) {
      return "HIGH";
    }

    if (entries.length >= 2) {
      return "MEDIUM";
    }

    return "LOW";
  }

  private async buildReviewWhere(
    currentUser: CurrentUser,
    intent: ReturnType<IntentDetector["detect"]>,
    laboratoryId?: number,
    status?: ReservationStatus
  ) {
    const dateWhere = {
      reservationDate: {
        gte: dayjs(intent.range.start).startOf("day").toDate(),
        lte: dayjs(intent.range.end).endOf("day").toDate()
      }
    };

    if (currentUser.role === "ADMIN") {
      return {
        ...dateWhere,
        ...(laboratoryId ? { laboratoryId } : {}),
        ...(status ? { status } : {})
      };
    }

    const assignedLabIds = await this.db.laboratory.findMany({
      where: {
        custodianId: currentUser.id
      },
      select: {
        id: true
      }
    });

    const labIds = laboratoryId
      ? assignedLabIds.some((laboratory) => laboratory.id === laboratoryId)
        ? [laboratoryId]
        : []
      : assignedLabIds.map((laboratory) => laboratory.id);

    return {
      ...dateWhere,
      laboratoryId: {
        in: labIds
      },
      ...(status ? { status } : {})
    };
  }

  private isRoleCapabilityQuestion(message: string) {
    return (
      message.includes("what can i do") ||
      message.includes("allowed to do") ||
      message.includes("ano pwede") ||
      message.includes("what are my permissions") ||
      message.includes("my access")
    );
  }

  private isAssignedLabQuestion(message: string) {
    return (
      message.includes("my lab") ||
      message.includes("assigned lab") ||
      message.includes("ano lab ko") ||
      message.includes("anong lab ko")
    );
  }

  private isLaboratoryCatalogQuestion(message: string) {
    return (
      (message.includes("show") || message.includes("list")) &&
      (message.includes("laborator") || message.includes("labs")) &&
      !message.includes("reserve") &&
      !message.includes("reservation")
    );
  }

  private extractLaboratoryStatusFilter(
    message: string,
    role: CurrentUser["role"]
  ): LaboratoryStatus | "NOT_AVAILABLE" | null {
    if (message.includes("maintenance")) {
      return "MAINTENANCE";
    }

    if (message.includes("inactive") || message.includes("unavailable")) {
      return "NOT_AVAILABLE";
    }

    if (message.includes("active") || role === "STUDENT") {
      return "AVAILABLE";
    }

    return null;
  }

  private isVisibleReservationQuery(message: string) {
    if (
      message.includes("how many") ||
      message.includes("ilang") ||
      message.includes("count") ||
      message.includes("need approval") ||
      message.includes("needing approval") ||
      message.includes("needs approval") ||
      message.includes("for approval") ||
      message.includes("pending approval") ||
      message.includes("who submitted")
    ) {
      return false;
    }

    return (
      (message.includes("show") ||
        message.includes("list") ||
        message.includes("sino") ||
        message.includes("who")) &&
      (message.includes("reservation") || message.includes("reservations")) &&
      !this.isReservationReviewCommand(message) &&
      !this.isReservationCreationCommand(message) &&
      !this.isReservationCancellationCommand(message)
    );
  }

  private isAnalyticsQuestion(message: string) {
    return (
      message.includes("summary") ||
      message.includes("summarize") ||
      message.includes("most used") ||
      message.includes("pinaka gamit") ||
      message.includes("busiest day") ||
      message.includes("pending vs approved") ||
      message.includes("trend") ||
      message.includes("report")
    );
  }

  private isReservationCreationCommand(message: string) {
    if (this.isReservationGuideCommand(message)) {
      return false;
    }

    const hasReservationVerb =
      /\breserve\b/.test(message) ||
      /\bbook\b/.test(message) ||
      message.includes("mag reserve") ||
      message.includes("pa reserve") ||
      message.includes("magpapa reserve") ||
      message.includes("magpareserve");

    if (!hasReservationVerb) {
      return false;
    }

    return (
      this.hasActionableReservationDetail(message) ||
      this.isGuidedReservationStartCommand(message)
    );
  }

  private isReservationGuideCommand(message: string) {
    return (
      message.includes("how to reserve") ||
      message.includes("how do i reserve") ||
      message.includes("how can i reserve") ||
      message.includes("how to make reservation") ||
      message.includes("how to make a reservation") ||
      message.includes("how do i make a reservation") ||
      message.includes("step by step") ||
      message.includes("step-by-step") ||
      message.includes("guide") ||
      message.includes("tutorial") ||
      message.includes("tell me how") ||
      message.includes("paano mag reserve") ||
      message.includes("paano magpa reserve") ||
      message.includes("paano magpareserve") ||
      message.includes("paano mag book") ||
      message.includes("paturo mag reserve")
    );
  }

  private hasActionableReservationDetail(message: string) {
    return Boolean(
      this.extractRoomCode(message) ||
        this.extractTimeRange(message) ||
        this.hasExplicitDateCue(message)
    );
  }

  private isGuidedReservationStartCommand(message: string) {
    return (
      message === "reserve" ||
      message === "book" ||
      message.includes("i want to reserve") ||
      message.includes("i need to reserve") ||
      message.includes("i would like to reserve") ||
      message.includes("pa reserve ako") ||
      message.includes("magpapa reserve ako") ||
      message.includes("magpa reserve ako") ||
      message.includes("mag reserve ako")
    );
  }

  private hasExplicitDateCue(message: string) {
    return (
      /\b(today|tomorrow|tonight)\b/.test(message) ||
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b/.test(message) ||
      /\b\d{4}-\d{2}-\d{2}\b/.test(message) ||
      /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(message) ||
      /\b(ngayon|bukas|mamaya|lunes|martes|miyerkules|mierkules|huwebes|biyernes|sabado|linggo)\b/.test(message)
    );
  }

  private isReservationCancellationCommand(message: string) {
    return (
      message.includes("cancel my reservation") ||
      message.includes("cancel reservation") ||
      message.includes("kanselahin")
    );
  }

  private isReservationReviewCommand(message: string) {
    return message.includes("approve") || message.includes("reject") || message.includes("tanggihan");
  }

  private isScheduleCreationCommand(message: string) {
    return (
      (message.includes("schedule") || message.includes("sched")) &&
      (message.includes("create") || message.includes("gawa") || message.includes("make"))
    );
  }

  private isLaboratoryManagementCommand(
    message: string,
    laboratory: LaboratorySummary | null,
    laboratories: LaboratorySummary[]
  ) {
    if (message.includes("laboratory") || message.includes(" lab ")) {
      return (
        message.includes("add") ||
        message.includes("create") ||
        message.includes("update") ||
        message.includes("deactivate") ||
        message.includes("delete") ||
        message.includes("remove") ||
        message.includes("maintenance") ||
        message.includes("tanggal")
      );
    }

    return Boolean(
      laboratory &&
        (message.includes("delete") ||
          message.includes("deactivate") ||
          message.includes("maintenance") ||
          message.includes("capacity") ||
          message.includes("update"))
    );
  }

  private isAmbiguousBulkReview(intent: ReturnType<IntentDetector["detect"]>) {
    return (
      intent.range.source === "default" &&
      !intent.laboratory &&
      !intent.normalizedMessage.includes("pending") &&
      !intent.normalizedMessage.includes("my lab")
    );
  }

  private permissionDeniedResponse(
    currentUser: CurrentUser,
    language: AssistantPendingActionRecord["language"],
    message: string
  ): HandledResponse {
    return {
      response: {
        reply: this.translatePlain(language, message),
        category: "permission_denied",
        suggestions: this.roleAwareSuggestions(currentUser.role, language)
      },
      query: contextManager.get(currentUser.id, currentUser.sessionId)?.activeQuery ?? null
    };
  }

  private clarificationResponse(
    currentUser: CurrentUser,
    language: AssistantPendingActionRecord["language"],
    message: string,
    intent: ReturnType<IntentDetector["detect"]>
  ): HandledResponse {
    return {
      response: {
        reply: this.translatePlain(language, message),
        category: "clarification",
        suggestions: this.roleAwareSuggestions(currentUser.role, language)
      },
      query: intent.previousQuery
    };
  }

  private translatePlain(
    language: AssistantPendingActionRecord["language"],
    englishMessage: string
  ) {
    return this.pick(language, {
      english: englishMessage,
      tagalog: englishMessage,
      taglish: englishMessage
    });
  }

  private roleAwareSuggestions(
    role: CurrentUser["role"],
    language: AssistantPendingActionRecord["language"]
  ) {
    if (role === "ADMIN") {
      return this.pick(language, {
        english: [
          "Show system summary.",
          "Show pending reservations today.",
          "Create schedules for all active labs next week 8-5."
        ],
        tagalog: [
          "Ipakita ang system summary.",
          "Ipakita ang pending reservations ngayong araw.",
          "Gumawa ng schedules para sa lahat ng active labs next week 8-5."
        ],
        taglish: [
          "Show system summary.",
          "Show pending reservations today.",
          "Create schedules for all active labs next week 8-5."
        ]
      });
    }

    if (role === "LABORATORY_STAFF") {
      return this.pick(language, {
        english: [
          "Show reservations needing approval.",
          "Show my lab schedule this week.",
          "Create schedule for my lab this week 8-5."
        ],
        tagalog: [
          "Ipakita ang reservations na kailangang i-approve.",
          "Ipakita ang schedule ng lab ko ngayong linggo.",
          "Gumawa ng schedule para sa lab ko ngayong linggo 8-5."
        ],
        taglish: [
          "Show reservations needing approval.",
          "Show my lab schedule this week.",
          "Create schedule for my lab this week 8-5."
        ]
      });
    }

    return this.pick(language, {
      english: [
        "Who am I?",
        "What are my reservations today?",
        "Reserve CL-302 tomorrow 9-10 for programming."
      ],
      tagalog: [
        "Sino ako?",
        "Ano ang reservations ko ngayong araw?",
        "Mag-reserve sa CL-302 bukas 9-10 para sa programming."
      ],
      taglish: [
        "Who am I?",
        "Ano reservation ko ngayon?",
        "Reserve CL-302 tomorrow 9-10 for programming."
      ]
    });
  }

  private roleLabel(role: CurrentUser["role"]) {
    if (role === "LABORATORY_STAFF") {
      return "Laboratory Staff";
    }

    if (role === "ADMIN") {
      return "Admin";
    }

    return "Student";
  }

  private inferLanguage(currentUser: CurrentUser) {
    return contextManager.get(currentUser.id, currentUser.sessionId)?.language ?? "english";
  }

  private cannotConfirmUserReply(language: AssistantPendingActionRecord["language"]) {
    return this.pick(language, {
      english: "I couldn't confirm your account details from the current system records yet.",
      tagalog: "Hindi ko pa mako-confirm ang account details mo mula sa current system records.",
      taglish: "Hindi ko pa ma-confirm ang account details mo from the current system records."
    });
  }

  private timeRangesOverlap(
    startA: string,
    endA: string,
    startB: string,
    endB: string
  ) {
    return startA < endB && startB < endA;
  }

  private pick<T>(
    language: AssistantPendingActionRecord["language"],
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
