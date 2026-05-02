import { EventEmitter } from "node:events";

export type NotificationEventType =
  | "reservation.created"
  | "reservation.confirmed"
  | "reservation.cancelled"
  | "reservation.reminder";

export type NotificationEventPayload = {
  reservationId: number;
  actorUserId?: number;
};

type NotificationHandler = (payload: NotificationEventPayload) => Promise<void> | void;

export class NotificationEventBus {
  private readonly emitter = new EventEmitter();

  subscribe(type: NotificationEventType, handler: NotificationHandler) {
    const wrappedHandler = (payload: NotificationEventPayload) => {
      Promise.resolve(handler(payload)).catch((error) => {
        console.error(`[notification] Failed to process ${type}.`, error);
      });
    };

    this.emitter.on(type, wrappedHandler);

    return () => {
      this.emitter.off(type, wrappedHandler);
    };
  }

  publish(type: NotificationEventType, payload: NotificationEventPayload) {
    setImmediate(() => {
      this.emitter.emit(type, payload);
    });
  }
}

export const notificationEventBus = new NotificationEventBus();
