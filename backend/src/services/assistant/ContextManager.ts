import type {
  AssistantActiveFlow,
  AssistantConversationContext,
  AssistantConversationMessage,
  AssistantLanguage,
  AssistantPendingDraft,
  AssistantQuerySnapshot
} from "./types.js";

const CONTEXT_TTL_MS = 30 * 60 * 1000;
const PENDING_DRAFT_TTL_MS = 15 * 60 * 1000;
const MAX_MESSAGES = 16;
const FLOW_TTL_MS = 15 * 60 * 1000;

export class ContextManager {
  private readonly contexts = new Map<string, AssistantConversationContext>();

  get(userId: number, sessionId: number) {
    this.pruneExpired();

    const context = this.contexts.get(this.buildKey(userId, sessionId)) ?? null;

    if (context?.pendingDraft && context.pendingDraft.expiresAt <= Date.now()) {
      context.pendingDraft = null;
    }

    return context;
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
    const context = this.ensureContext(
      userId,
      sessionId,
      query?.language ?? this.get(userId, sessionId)?.language ?? "english"
    );
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

  getPendingActionId(userId: number, sessionId: number) {
    return this.get(userId, sessionId)?.pendingActionId ?? null;
  }

  getActiveFlow(userId: number, sessionId: number) {
    const flow = this.get(userId, sessionId)?.activeFlow ?? null;

    if (!flow || flow.expiresAt <= Date.now()) {
      this.clearActiveFlow(userId, sessionId);
      return null;
    }

    return flow;
  }

  setActiveFlow(
    userId: number,
    sessionId: number,
    flow: Omit<AssistantActiveFlow, "createdAt" | "expiresAt">
  ) {
    const context = this.ensureContext(userId, sessionId, "english");
    context.activeFlow = {
      ...flow,
      createdAt: Date.now(),
      expiresAt: Date.now() + FLOW_TTL_MS
    };
    context.updatedAt = Date.now();
  }

  clearActiveFlow(userId: number, sessionId: number) {
    const context = this.get(userId, sessionId);

    if (!context) {
      return;
    }

    context.activeFlow = null;
    context.updatedAt = Date.now();
  }

  setPendingActionId(userId: number, sessionId: number, actionId: string | null) {
    const context = this.ensureContext(userId, sessionId, "english");
    context.pendingActionId = actionId;
    if (actionId) {
      context.activeFlow = null;
    }
    context.updatedAt = Date.now();
  }

  getPendingDraft(userId: number, sessionId: number) {
    return this.get(userId, sessionId)?.pendingDraft ?? null;
  }

  setPendingDraft(
    userId: number,
    sessionId: number,
    draft: Omit<AssistantPendingDraft, "createdAt" | "updatedAt" | "expiresAt"> | null
  ) {
    const context = this.ensureContext(userId, sessionId, draft?.language ?? "english");

    context.pendingDraft = draft
      ? {
          ...draft,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + PENDING_DRAFT_TTL_MS
        }
      : null;
    context.updatedAt = Date.now();
  }

  updatePendingDraft(
    userId: number,
    sessionId: number,
    draft: AssistantPendingDraft | null
  ) {
    const context = this.ensureContext(userId, sessionId, draft?.language ?? "english");

    context.pendingDraft = draft
      ? {
          ...draft,
          updatedAt: Date.now(),
          expiresAt: Date.now() + PENDING_DRAFT_TTL_MS
        }
      : null;
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
      activeFlow: null,
      pendingActionId: null,
      pendingDraft: null,
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
