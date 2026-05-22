import type { Response } from "express";

type NotificationStreamPayload = Record<string, unknown>;

export class NotificationRealtimeService {
  private readonly clients = new Map<number, Set<Response>>();

  subscribe(userId: number, res: Response) {
    const existingClients = this.clients.get(userId) ?? new Set<Response>();
    existingClients.add(res);
    this.clients.set(userId, existingClients);

    res.write(`event: ready\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, 30_000);

    return () => {
      clearInterval(heartbeat);

      const subscribers = this.clients.get(userId);
      if (!subscribers) {
        return;
      }

      subscribers.delete(res);

      if (subscribers.size === 0) {
        this.clients.delete(userId);
      }
    };
  }

  publishToUser(userId: number, payload: NotificationStreamPayload) {
    return this.publishEventToUser(userId, "notification", payload);
  }

  publishEventToUser(userId: number, eventName: string, payload: NotificationStreamPayload) {
    const subscribers = this.clients.get(userId);

    if (!subscribers?.size) {
      return false;
    }

    const serializedPayload = JSON.stringify(payload);

    for (const client of subscribers) {
      client.write(`event: ${eventName}\ndata: ${serializedPayload}\n\n`);
    }

    return true;
  }
}

export const notificationRealtimeService = new NotificationRealtimeService();
