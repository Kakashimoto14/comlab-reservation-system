import type {
  AssistantConversationContext,
  AssistantConversationMessage,
  AssistantLanguage,
  AssistantQuerySnapshot
} from "./types.js";

const CONTEXT_TTL_MS = 30 * 60 * 1000;
const MAX_MESSAGES = 16;

export class ContextManager {
  private readonly contexts = new Map<string, AssistantConversationContext>();

  get(userId: number, sessionId: number) {
    this.pruneExpired();

    return this.contexts.get(this.buildKey(userId, sessionId)) ?? null;
  }

  appendUserMessage(
    userId: number,
    sessionId: number,
    language: AssistantLanguage,
    content: string
  ) {
    const context = this.ensureContext(userId, sessionId, language);
    context.language = language;
    context.messages = this.trimMessages([
      ...context.messages,
      {
        role: "user",
        content,
        timestamp: Date.now()
      }
    ]);
    context.updatedAt = Date.now();
  }

  appendAssistantMessage(
    userId: number,
    sessionId: number,
    content: string,
    category: AssistantQuerySnapshot["category"],
    query: AssistantQuerySnapshot | null
  ) {
    const context = this.ensureContext(userId, sessionId, query?.language ?? "english");
    context.messages = this.trimMessages([
      ...context.messages,
      {
        role: "assistant",
        content,
        category,
        timestamp: Date.now()
      }
    ]);
    context.activeQuery = query;
    context.updatedAt = Date.now();
  }

  private ensureContext(userId: number, sessionId: number, language: AssistantLanguage) {
    const key = this.buildKey(userId, sessionId);
    const existing = this.contexts.get(key);

    if (existing) {
      return existing;
    }

    const created: AssistantConversationContext = {
      sessionKey: key,
      userId,
      sessionId,
      language,
      messages: [],
      activeQuery: null,
      updatedAt: Date.now()
    };
    this.contexts.set(key, created);

    return created;
  }

  private trimMessages(messages: AssistantConversationMessage[]) {
    return messages.slice(-MAX_MESSAGES);
  }

  private pruneExpired() {
    const now = Date.now();

    for (const [key, context] of this.contexts.entries()) {
      if (now - context.updatedAt > CONTEXT_TTL_MS) {
        this.contexts.delete(key);
      }
    }
  }

  private buildKey(userId: number, sessionId: number) {
    return `${userId}:${sessionId}`;
  }
}
