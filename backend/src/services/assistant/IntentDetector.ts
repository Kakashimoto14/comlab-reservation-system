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
  "vacant schedule",
  "may schedule",
  "reservation ko",
  "ano reservation ko",
  "available ba",
  "open slot",
  "multimedia",
  "networking"
];

const MY_RESERVATIONS_KEYWORDS = [
  "my reservation",
  "my reservations",
  "reservation ko",
  "ano reservation ko",
  "show my reservation",
  "show my reservations",
  "pending reservation",
  "approved reservation",
  "rejected reservation",
  "reservation status"
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
    const hasExplicitLab = matchedLaboratory !== null && matchedLaboratory !== previousQuery?.laboratory;
    const onlyTemporalOrLabFollowUp =
      Boolean(previousQuery) &&
      (isShowMore ||
        isShortFollowUpMessage(normalizedMessage) ||
        /^(what about|how about|sa |for |about )/.test(normalizedMessage));

    if (isShowMore && previousQuery) {
      return {
        category: previousQuery.category,
        range: previousQuery.range,
        laboratory: previousQuery.laboratory,
        language,
        isFollowUp: true,
        isShowMore: true,
        normalizedMessage,
        previousQuery
      };
    }

    if (this.isGreeting(normalizedMessage)) {
      return {
        category: "general_reservation_help",
        range,
        laboratory: null,
        language,
        isFollowUp: false,
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
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

      return {
        category: followUpCategory,
        range: range.source === "default" ? previousQuery.range : range,
        laboratory: matchedLaboratory ?? previousQuery.laboratory,
        language,
        isFollowUp: true,
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (hasAnyKeyword(normalizedMessage, MY_RESERVATIONS_KEYWORDS)) {
      return {
        category: "my_reservations",
        range,
        laboratory: null,
        language,
        isFollowUp: Boolean(previousQuery),
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (hasAnyKeyword(normalizedMessage, RULE_KEYWORDS)) {
      return {
        category: "reservation_rules",
        range,
        laboratory: null,
        language,
        isFollowUp: false,
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (matchedLaboratory && hasAnyKeyword(normalizedMessage, LAB_LOOKUP_KEYWORDS)) {
      return {
        category: "laboratory_lookup",
        range,
        laboratory: matchedLaboratory,
        language,
        isFollowUp: Boolean(previousQuery),
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (matchedLaboratory) {
      return {
        category: "specific_laboratory",
        range: range.source === "default" && previousQuery ? previousQuery.range : range,
        laboratory: matchedLaboratory,
        language,
        isFollowUp: Boolean(previousQuery),
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (hasAnyKeyword(normalizedMessage, SCHEDULE_KEYWORDS)) {
      return {
        category: "available_schedules",
        range,
        laboratory: previousQuery?.laboratory ?? null,
        language,
        isFollowUp: Boolean(previousQuery),
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (hasAnyKeyword(normalizedMessage, LAB_AVAILABILITY_KEYWORDS)) {
      return {
        category: "available_laboratories",
        range,
        laboratory: null,
        language,
        isFollowUp: Boolean(previousQuery),
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (
      previousQuery &&
      onlyTemporalOrLabFollowUp &&
      isScheduleCategory(previousQuery.category)
    ) {
      return {
        category: previousQuery.category,
        range: range.source === "default" ? previousQuery.range : range,
        laboratory: previousQuery.laboratory,
        language,
        isFollowUp: true,
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    if (
      hasAnyKeyword(normalizedMessage, RESERVATION_DOMAIN_KEYWORDS) ||
      hasAnyKeyword(normalizedMessage, SAME_LAB_PATTERNS) ||
      hasAnyKeyword(normalizedMessage, SHOW_MORE_PATTERNS)
    ) {
      return {
        category: "general_reservation_help",
        range,
        laboratory: previousQuery?.laboratory ?? null,
        language,
        isFollowUp: Boolean(previousQuery),
        isShowMore: false,
        normalizedMessage,
        previousQuery
      };
    }

    return {
      category: "out_of_scope",
      range,
      laboratory: null,
      language,
      isFollowUp: false,
      isShowMore: false,
      normalizedMessage,
      previousQuery
    };
  }

  private isGreeting(message: string) {
    return GREETING_PATTERNS.includes(message);
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
