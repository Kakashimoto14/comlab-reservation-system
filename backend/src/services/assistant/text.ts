import type { AssistantConversationContext, AssistantLanguage } from "./types.js";

const TAGALOG_HINTS = [
  "may ",
  "ba",
  "bukas",
  "ngayon",
  "mamaya",
  "linggo",
  "buwan",
  "unang",
  "susunod",
  "ano",
  "anong",
  "sa ",
  "ko",
  "pwede",
  "puwede",
  "vacant",
  "bukas",
  "dito",
  "kamusta"
];

const ENGLISH_HINTS = [
  "what",
  "when",
  "where",
  "show",
  "check",
  "available",
  "reservation",
  "schedule",
  "tomorrow",
  "today",
  "next ",
  "please",
  "help"
];

export const normalizeAssistantText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9\s:/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const detectAssistantLanguage = (
  message: string,
  context?: AssistantConversationContext | null
): AssistantLanguage => {
  const normalized = normalizeAssistantText(message);
  const tagalogHits = TAGALOG_HINTS.filter((hint) => normalized.includes(hint)).length;
  const englishHits = ENGLISH_HINTS.filter((hint) => normalized.includes(hint)).length;

  if (tagalogHits > 0 && englishHits === 0) {
    return "tagalog";
  }

  if (tagalogHits > 0 && englishHits > 0) {
    return "taglish";
  }

  return context?.language ?? "english";
};

export const hasAnyKeyword = (message: string, keywords: string[]) =>
  keywords.some((keyword) => message.includes(keyword));

export const isShortFollowUpMessage = (message: string) => {
  const words = message.split(" ").filter(Boolean);
  return words.length > 0 && words.length <= 6;
};
