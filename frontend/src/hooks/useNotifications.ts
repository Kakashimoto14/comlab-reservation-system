import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiBaseUrl } from "../api/client";
import { notificationApi } from "../api/services";
import type { NotificationListResponse, NotificationRecord } from "../types/api";
import { useAuth } from "../store/AuthContext";

const NOTIFICATIONS_QUERY_KEY = ["notifications"];

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

    stream.addEventListener("notification", handleNotification);

    return () => {
      stream.removeEventListener("notification", handleNotification);
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
