import { DateRangeParser } from "./DateRangeParser.js";
import {
  detectAssistantLanguage,
  hasAnyKeyword,
  isShortFollowUpMessage,
  normalizeAssistantText
} from "./text.js";
import type {
  AssistantConversationContext,
  IntentAnalysis,
  LaboratorySummary
} from "./types.js";

const GREETING_PATTERNS = [
  "hi",
  "hello",
  "hey",
  "good morning",
  "good afternoon",
  "good evening",
  "kumusta",
  "kamusta"
];

const RESERVATION_DOMAIN_KEYWORDS = [
  "reservation",
  "reserve",
  "schedule",
  "available",
  "availability",
  "open slot",
  "open time",
  "time slot",
  "vacant",
  "lab",
  "laboratory",
  "room",
  "cl-",
  "bukas",
  "ngayon",
  "linggo",
  "buwan",
  "slot",
  "may schedule",
  "reservation ko",
  "ano reservation ko",
  "available ba",
  "multimedia",
  "networking"
];

const CURRENT_USER_KEYWORDS = [
  "who am i",
  "sino ako",
  "what is my role",
  "ano role ko",
  "anong role ko",
  "what is my email",
  "ano email ko",
  "anong email ko",
  "what is my student number",
  "student number ko",
  "who is my account",
  "tell me about my account"
];

const MY_RESERVATIONS_KEYWORDS = [
  "my reservation",
  "my reservations",
  "reservation ko",
  "ano reservation ko",
  "show my reservation",
  "show my reservations",
  "my upcoming reservation",
  "my upcoming reservations",
  "upcoming reservations",
  "latest reservation status",
  "reservation status ko",
  "ano reservation ko ngayon",
  "what are my reservations today",
  "what is my latest reservation"
];

const RULE_KEYWORDS = [
  "rule",
  "rules",
  "policy",
  "policies",
  "how can i reserve",
  "how do i reserve",
  "how to reserve",
  "paano mag reserve",
  "paano magpa reserve",
  "guide",
  "help me reserve"
];

const RESERVATION_GUIDE_KEYWORDS = [
  "step by step reservation",
  "step-by-step reservation",
  "reservation step by step",
  "how to reserve",
  "how do i reserve",
  "how can i reserve",
  "how to make reservation",
  "how to make a reservation",
  "how do i make a reservation",
  "give me the step by step guide",
  "step by step guide",
  "tell me how",
  "guide me",
  "guide me to reserve",
  "help me reserve",
  "reservation guide",
  "reservation tutorial",
  "walk me through reservation",
  "how does reservation work",
  "how to book",
  "how do i book a lab",
  "paano mag reserve",
  "paano magpa reserve",
  "paano magpareserve",
  "paano gumawa ng reservation",
  "paano mag book",
  "paano mag book ng lab",
  "paano mag request ng reservation",
  "pa guide mag reserve",
  "paturo mag reserve",
  "tulungan mo ako mag reserve",
  "guide mo ako mag reserve",
  "paano ito gamitin sa reservation"
];

const RESERVATION_GUIDE_FOLLOW_UPS = new Set([
  "how",
  "steps",
  "guide",
  "tutorial",
  "tell me how",
  "step by step",
  "step-by-step"
]);

const SCHEDULE_KEYWORDS = [
  "schedule",
  "schedules",
  "slot",
  "time slot",
  "open slot",
  "vacant schedule",
  "available schedule",
  "anong vacant",
  "may schedule",
  "unang linggo",
  "next week",
  "next month"
];

const LAB_AVAILABILITY_KEYWORDS = [
  "available lab",
  "available laboratory",
  "available ba",
  "which lab",
  "which laboratory",
  "open lab",
  "open laboratory",
  "vacant lab"
];

const LAB_LOOKUP_KEYWORDS = ["where is", "location", "details", "about", "info", "what is"];

const NOTIFICATION_KEYWORDS = [
  "what notifications do i have",
  "notifications",
  "notification",
  "notification ko",
  "notifications ko",
  "any updates",
  "updates about my reservations",
  "updates about my reservation",
  "reservation updates",
  "ano notification ko"
];

const ADMIN_STATS_KEYWORDS = [
  "how many pending reservations",
  "ilang pending reservation",
  "pending reservations in the whole system",
  "whole system pending",
  "system pending",
  "pending reservations exist",
  "active users count",
  "labs count",
  "approved reservations count",
  "rejected reservations count"
];

const APPROVAL_QUEUE_KEYWORDS = [
  "which reservations need approval",
  "show reservations needing approval",
  "reservations needing approval",
  "need approval",
  "needs approval",
  "for approval",
  "pending approval",
  "show pending reservations"
];

const RESERVATION_SUBMITTER_KEYWORDS = [
  "who made this reservation",
  "who made the latest reservation",
  "who submitted the latest reservation",
  "who submitted this reservation",
  "who submitted reservation",
  "sino gumawa ng reservation",
  "sino nagsubmit ng reservation"
];

const RECENT_ACTIVITY_KEYWORDS = [
  "recent actions",
  "recent activity",
  "activity log",
  "what recent actions happened",
  "anong recent actions",
  "anong recent activity"
];

const SYSTEM_INFO_KEYWORDS = [
  "what is comport",
  "what is comport",
  "what is comlab",
  "ano ang comport",
  "ano ang comlab"
];

const USER_DIRECTORY_KEYWORDS = [
  "who are the staff",
  "list staff",
  "staff list",
  "who are the admins",
  "who are the laboratory staff"
];

const SHOW_MORE_PATTERNS = ["show more", "more please", "pakita pa", "dagdag pa", "more"];
const SAME_LAB_PATTERNS = ["same lab", "same laboratory", "same room", "same cl"];

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "is",
  "are",
  "for",
  "in",
  "on",
  "at",
  "sa",
  "ng",
  "lab",
  "laboratory",
  "room",
  "available",
  "schedule",
  "schedules",
  "what",
  "about",
  "how",
  "can",
  "you",
  "check"
]);

const isScheduleCategory = (category?: string | null) =>
  category === "available_schedules" ||
  category === "available_laboratories" ||
  category === "specific_laboratory";

export class IntentDetector {
  constructor(private readonly dateRangeParser: DateRangeParser) {}

  detect(
    message: string,
    laboratories: LaboratorySummary[],
    context?: AssistantConversationContext | null
  ): IntentAnalysis {
    const normalizedMessage = normalizeAssistantText(message);
    const previousQuery = context?.activeQuery ?? null;
    const language = detectAssistantLanguage(message, context);
    const matchedLaboratory = this.resolveLaboratory(
      normalizedMessage,
      laboratories,
      previousQuery?.laboratory ?? null
    );
    const isShowMore = SHOW_MORE_PATTERNS.some((pattern) => normalizedMessage === pattern);
    const range = this.dateRangeParser.parse(message, context);
    const onlyTemporalOrLabFollowUp =
      Boolean(previousQuery) &&
      (isShowMore ||
        isShortFollowUpMessage(normalizedMessage) ||
        /^(what about|how about|sa |for |about )/.test(normalizedMessage));

    if (isShowMore && previousQuery) {
      return this.buildIntent(previousQuery.category, {
        range: previousQuery.range,
        laboratory: previousQuery.laboratory,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: true,
        isShowMore: true
      });
    }

    if (this.isGreeting(normalizedMessage)) {
      return this.buildIntent("general_reservation_help", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (this.isReservationGuideQuestion(normalizedMessage, context)) {
      return this.buildIntent("reservation_guide", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: this.isReservationGuideFollowUp(normalizedMessage)
      });
    }

    if (hasAnyKeyword(normalizedMessage, CURRENT_USER_KEYWORDS)) {
      return this.buildIntent("current_user", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (hasAnyKeyword(normalizedMessage, NOTIFICATION_KEYWORDS)) {
      return this.buildIntent("notifications", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (hasAnyKeyword(normalizedMessage, RECENT_ACTIVITY_KEYWORDS)) {
      return this.buildIntent("recent_activity", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (hasAnyKeyword(normalizedMessage, USER_DIRECTORY_KEYWORDS)) {
      return this.buildIntent("user_directory", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (hasAnyKeyword(normalizedMessage, SYSTEM_INFO_KEYWORDS)) {
      return this.buildIntent("system_info", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (hasAnyKeyword(normalizedMessage, APPROVAL_QUEUE_KEYWORDS)) {
      return this.buildIntent("approval_queue", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (hasAnyKeyword(normalizedMessage, RESERVATION_SUBMITTER_KEYWORDS)) {
      return this.buildIntent("reservation_submitter", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (this.isAdminStatsQuestion(normalizedMessage)) {
      return this.buildIntent("admin_stats", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (
      previousQuery &&
      onlyTemporalOrLabFollowUp &&
      (matchedLaboratory !== null || isScheduleCategory(previousQuery.category))
    ) {
      const followUpCategory =
        matchedLaboratory !== null
          ? "specific_laboratory"
          : previousQuery.category === "specific_laboratory" && previousQuery.laboratory
            ? "specific_laboratory"
            : previousQuery.category;

      return this.buildIntent(followUpCategory, {
        range: range.source === "default" ? previousQuery.range : range,
        laboratory: matchedLaboratory ?? previousQuery.laboratory,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: true
      });
    }

    if (
      hasAnyKeyword(normalizedMessage, MY_RESERVATIONS_KEYWORDS) ||
      (this.referencesOwnData(normalizedMessage) &&
        normalizedMessage.includes("reservation") &&
        !this.isAdminStatsQuestion(normalizedMessage))
    ) {
      return this.buildIntent("my_reservations", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: Boolean(previousQuery)
      });
    }

    if (hasAnyKeyword(normalizedMessage, RULE_KEYWORDS)) {
      return this.buildIntent("reservation_rules", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery
      });
    }

    if (matchedLaboratory && hasAnyKeyword(normalizedMessage, LAB_LOOKUP_KEYWORDS)) {
      return this.buildIntent("laboratory_lookup", {
        range,
        laboratory: matchedLaboratory,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: Boolean(previousQuery)
      });
    }

    if (matchedLaboratory) {
      return this.buildIntent("specific_laboratory", {
        range: range.source === "default" && previousQuery ? previousQuery.range : range,
        laboratory: matchedLaboratory,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: Boolean(previousQuery)
      });
    }

    if (hasAnyKeyword(normalizedMessage, SCHEDULE_KEYWORDS)) {
      return this.buildIntent("available_schedules", {
        range,
        laboratory: previousQuery?.laboratory ?? null,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: Boolean(previousQuery)
      });
    }

    if (hasAnyKeyword(normalizedMessage, LAB_AVAILABILITY_KEYWORDS)) {
      return this.buildIntent("available_laboratories", {
        range,
        laboratory: null,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: Boolean(previousQuery)
      });
    }

    if (
      previousQuery &&
      onlyTemporalOrLabFollowUp &&
      isScheduleCategory(previousQuery.category)
    ) {
      return this.buildIntent(previousQuery.category, {
        range: range.source === "default" ? previousQuery.range : range,
        laboratory: previousQuery.laboratory,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: true
      });
    }

    if (
      hasAnyKeyword(normalizedMessage, RESERVATION_DOMAIN_KEYWORDS) ||
      hasAnyKeyword(normalizedMessage, SAME_LAB_PATTERNS) ||
      hasAnyKeyword(normalizedMessage, SHOW_MORE_PATTERNS)
    ) {
      return this.buildIntent("general_reservation_help", {
        range,
        laboratory: previousQuery?.laboratory ?? null,
        language,
        normalizedMessage,
        previousQuery,
        isFollowUp: Boolean(previousQuery)
      });
    }

    return this.buildIntent("out_of_scope", {
      range,
      laboratory: null,
      language,
      normalizedMessage,
      previousQuery
    });
  }

  private buildIntent(
    category: IntentAnalysis["category"],
    input: {
      range: IntentAnalysis["range"];
      laboratory: IntentAnalysis["laboratory"];
      language: IntentAnalysis["language"];
      normalizedMessage: IntentAnalysis["normalizedMessage"];
      previousQuery: IntentAnalysis["previousQuery"];
      isFollowUp?: boolean;
      isShowMore?: boolean;
    }
  ): IntentAnalysis {
    return {
      category,
      range: input.range,
      laboratory: input.laboratory,
      language: input.language,
      isFollowUp: input.isFollowUp ?? false,
      isShowMore: input.isShowMore ?? false,
      normalizedMessage: input.normalizedMessage,
      previousQuery: input.previousQuery
    };
  }

  private isGreeting(message: string) {
    return GREETING_PATTERNS.includes(message);
  }

  private referencesOwnData(message: string) {
    return /\b(my|mine|ako|ko)\b/.test(message);
  }

  private isAdminStatsQuestion(message: string) {
    return (
      hasAnyKeyword(message, ADMIN_STATS_KEYWORDS) &&
      (!this.referencesOwnData(message) || message.includes("whole system"))
    );
  }

  private isReservationGuideQuestion(
    message: string,
    context?: AssistantConversationContext | null
  ) {
    if (hasAnyKeyword(message, RESERVATION_GUIDE_KEYWORDS)) {
      return true;
    }

    return this.isReservationGuideFollowUp(message) && this.hasRecentReservationGuideContext(context);
  }

  private isReservationGuideFollowUp(message: string) {
    return RESERVATION_GUIDE_FOLLOW_UPS.has(message);
  }

  private hasRecentReservationGuideContext(context?: AssistantConversationContext | null) {
    if (!context) {
      return false;
    }

    if (context.activeFlow?.activeFlow === "GUIDED_RESERVATION_FLOW") {
      return true;
    }

    return context.messages
      .slice(-4)
      .some(
        (message) =>
          message.category === "reservation_guide" ||
          hasAnyKeyword(normalizeAssistantText(message.content), RESERVATION_GUIDE_KEYWORDS)
      );
  }

  private resolveLaboratory(
    message: string,
    laboratories: LaboratorySummary[],
    previousLaboratory: LaboratorySummary | null
  ) {
    if (SAME_LAB_PATTERNS.some((pattern) => message.includes(pattern))) {
      return previousLaboratory;
    }

    const rankedMatches = laboratories
      .map((laboratory) => ({
        laboratory,
        score: this.matchLaboratoryScore(message, laboratory)
      }))
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score);

    return rankedMatches[0]?.laboratory ?? null;
  }

  private matchLaboratoryScore(message: string, laboratory: LaboratorySummary) {
    const roomCode = laboratory.roomCode.toLowerCase();
    const normalizedRoomCode = roomCode.replace(/\s+/g, "");
    const normalizedName = normalizeAssistantText(laboratory.name);

    if (message.includes(roomCode) || message.includes(normalizedRoomCode)) {
      return 100;
    }

    if (message.includes(normalizedName)) {
      return 90;
    }

    const messageTokens = message
      .split(" ")
      .filter((token) => token.length > 2 && !STOPWORDS.has(token));
    const nameTokens = normalizedName.split(" ").filter((token) => token.length > 2);
    const matchingTokens = messageTokens.filter((token) => nameTokens.includes(token));

    if (matchingTokens.length && matchingTokens.length === messageTokens.length) {
      return 70;
    }

    if (matchingTokens.length) {
      return 40;
    }

    return 0;
  }
}
