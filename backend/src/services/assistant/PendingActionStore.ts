import type { AssistantPendingActionRecord } from "./types.js";

const DEFAULT_PENDING_ACTION_TTL_MS = 15 * 60 * 1000;

export class PendingActionStore {
  private readonly actions = new Map<string, AssistantPendingActionRecord>();

  create(record: Omit<AssistantPendingActionRecord, "expiresAt">, ttlMs = DEFAULT_PENDING_ACTION_TTL_MS) {
    this.pruneExpired();

    const storedRecord: AssistantPendingActionRecord = {
      ...record,
      expiresAt: Date.now() + ttlMs
    };
    this.actions.set(storedRecord.actionId, storedRecord);

    return storedRecord;
  }

  get(actionId: string) {
    this.pruneExpired();

    return this.actions.get(actionId) ?? null;
  }

  delete(actionId: string) {
    this.actions.delete(actionId);
  }

  pruneExpired() {
    const now = Date.now();

    for (const [actionId, action] of this.actions.entries()) {
      if (action.expiresAt <= now) {
        this.actions.delete(actionId);
      }
    }
  }
}
