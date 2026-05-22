import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { apiBaseUrl } from "../api/client";
import { notificationApi } from "../api/services";
import type { NotificationListResponse, NotificationRecord } from "../types/api";
import { useAuth } from "../store/AuthContext";

const NOTIFICATIONS_QUERY_KEY = ["notifications"];
const RESERVATION_EVENT_NAMES = [
  "reservation.created",
  "reservation.updated",
  "reservation.approved",
  "reservation.rejected",
  "reservation.cancelled",
  "reservation.completed"
] as const;

type ReservationStreamPayload = {
  type?: string;
  reservationCode?: string;
  status?: string;
  actorUserId?: number;
};

export const useNotifications = (limit = 8) => {
  const { user, initialized } = useAuth();
  const queryClient = useQueryClient();

  const notificationsQuery = useQuery({
    queryKey: [...NOTIFICATIONS_QUERY_KEY, limit],
    queryFn: () => notificationApi.list({ limit }),
    enabled: initialized && Boolean(user)
  });

  useEffect(() => {
    if (!initialized || !user) {
      return;
    }

    const stream = new EventSource(`${apiBaseUrl}/notifications/stream`, {
      withCredentials: true
    });

    const handleNotification = () => {
      void queryClient.invalidateQueries({
        queryKey: NOTIFICATIONS_QUERY_KEY
      });
    };
    const handleReservationUpdate = (event: Event) => {
      const payload = parseReservationPayload(event);

      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["staff-reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });

      if (payload.actorUserId && payload.actorUserId === user.id) {
        return;
      }

      const toastMessage = buildReservationToastMessage(payload);

      if (toastMessage) {
        toast(toastMessage);
      }
    };

    stream.addEventListener("notification", handleNotification);
    RESERVATION_EVENT_NAMES.forEach((eventName) => {
      stream.addEventListener(eventName, handleReservationUpdate);
    });

    return () => {
      stream.removeEventListener("notification", handleNotification);
      RESERVATION_EVENT_NAMES.forEach((eventName) => {
        stream.removeEventListener(eventName, handleReservationUpdate);
      });
      stream.close();
    };
  }, [initialized, queryClient, user]);

  const markAsReadMutation = useMutation({
    mutationFn: (id: number) => notificationApi.markAsRead(id),
    onSuccess: (updatedNotification) => {
      queryClient.setQueryData<NotificationListResponse | undefined>(
        [...NOTIFICATIONS_QUERY_KEY, limit],
        (current) => {
          if (!current) {
            return current;
          }

          const wasUnread = current.items.some(
            (notification) => notification.id === updatedNotification.id && !notification.readAt
          );

          return {
            unreadCount: wasUnread
              ? Math.max(0, current.unreadCount - 1)
              : current.unreadCount,
            items: current.items.map((notification) =>
              notification.id === updatedNotification.id ? updatedNotification : notification
            )
          };
        }
      );
    }
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.setQueryData<NotificationListResponse | undefined>(
        [...NOTIFICATIONS_QUERY_KEY, limit],
        (current) =>
          current
            ? {
                unreadCount: 0,
                items: current.items.map((notification) => ({
                  ...notification,
                  readAt: notification.readAt ?? new Date().toISOString()
                }))
              }
            : current
      );
    }
  });

  return {
    items: notificationsQuery.data?.items ?? ([] as NotificationRecord[]),
    unreadCount: notificationsQuery.data?.unreadCount ?? 0,
    isLoading: notificationsQuery.isLoading,
    markAsRead: (id: number) => markAsReadMutation.mutateAsync(id),
    markAllAsRead: () => markAllAsReadMutation.mutateAsync(),
    isMarkingAllAsRead: markAllAsReadMutation.isPending
  };
};

const parseReservationPayload = (event: Event): ReservationStreamPayload => {
  if (!("data" in event) || typeof event.data !== "string") {
    return {};
  }

  try {
    return JSON.parse(event.data) as ReservationStreamPayload;
  } catch {
    return {};
  }
};

const buildReservationToastMessage = (payload: ReservationStreamPayload) => {
  if (!payload.reservationCode || !payload.status) {
    return null;
  }

  if (payload.type === "reservation.approved") {
    return `Reservation ${payload.reservationCode} was approved.`;
  }

  if (payload.type === "reservation.rejected") {
    return `Reservation ${payload.reservationCode} was rejected.`;
  }

  if (payload.type === "reservation.completed") {
    return `Reservation ${payload.reservationCode} was marked completed.`;
  }

  if (payload.type === "reservation.cancelled") {
    return `Reservation ${payload.reservationCode} was cancelled.`;
  }

  return null;
};
