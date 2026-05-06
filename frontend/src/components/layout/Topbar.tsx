import { Bell, CalendarDays, LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

import { useNotifications } from "../../hooks/useNotifications";
import { useAuth } from "../../store/AuthContext";
import { roleLabels } from "../../utils/constants";

const routeMeta = [
  { match: "/student/dashboard", title: "Student Dashboard", description: "Track your booking activity and latest reservation updates." },
  { match: "/student/laboratories", title: "Laboratory Catalog", description: "Browse available laboratories, schedules, and reservation windows." },
  { match: "/student/reservations", title: "Reservation History", description: "Review your requests, status changes, and staff remarks." },
  { match: "/dashboard", title: "Operations Dashboard", description: "Monitor reservation volume, approval queues, and laboratory usage." },
  { match: "/management/users", title: "User Administration", description: "Manage access, roles, and account status across the system." },
  { match: "/management/laboratories", title: "Laboratory Administration", description: "Maintain rooms, capacities, media, and availability status." },
  { match: "/management/schedules", title: "Schedule Administration", description: "Publish reservation slots and prevent schedule conflicts." },
  { match: "/management/reservations", title: "Reservation Workflow", description: "Review pending requests and complete reservation decisions." },
  { match: "/management/reports", title: "Reports and Insights", description: "Review utilization, trends, and exportable reservation data." },
  { match: "/profile", title: "Account Settings", description: "Update your profile details and password securely." }
];

export const Topbar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { items, unreadCount, isLoading, markAsRead, markAllAsRead, isMarkingAllAsRead } =
    useNotifications(8);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement | null>(null);

  const currentRoute = useMemo(
    () =>
      routeMeta.find((item) =>
        item.match === "/dashboard"
          ? location.pathname === item.match
          : location.pathname.startsWith(item.match)
      ) ?? {
        title: "ComLab Portal",
        description: "Manage laboratory reservations with clarity and accountability."
      },
    [location.pathname]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const formatNotificationTimestamp = (value: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value));

  return (
    <div className="mb-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-500">
            {currentRoute.title}
          </p>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            {currentRoute.description}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              <ShieldCheck className="h-4 w-4 text-brand-500" />
              Active Session
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-900">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {user ? roleLabels[user.role] : "Authenticated User"}
            </p>
          </div>

          <div className="flex items-center gap-3" ref={notificationRef}>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                <CalendarDays className="h-4 w-4 text-brand-500" />
                Today
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-900">
                {new Intl.DateTimeFormat("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric"
                }).format(new Date())}
              </p>
            </div>
            <button
              type="button"
              className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 xl:inline-flex"
              onClick={logout}
            >
              <LogOut className="h-4 w-4 text-brand-500" />
              Logout
            </button>
            <div className="relative">
              <button
                type="button"
                aria-label="Open notifications"
                className="relative rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-50"
                onClick={() => setNotificationsOpen((current) => !current)}
              >
                {unreadCount ? (
                  <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                ) : null}

                <Bell className="h-4 w-4" />
              </button>

              {notificationsOpen ? (
                <div className="absolute right-0 z-20 mt-3 w-[min(22rem,calc(100vw-2rem))] max-w-[22rem] rounded-3xl border border-slate-200 bg-white p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Notifications</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "You're all caught up."}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="text-xs font-semibold text-brand-700 disabled:text-slate-300"
                      disabled={!unreadCount || isMarkingAllAsRead}
                      onClick={() => void markAllAsRead()}
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    {isLoading ? (
                      Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
                      ))
                    ) : items.length ? (
                      items.map((notification) => (
                        <button
                          key={notification.id}
                          type="button"
                          className={`block w-full rounded-2xl border px-4 py-3 text-left transition ${
                            notification.readAt
                              ? "border-slate-200 bg-white"
                              : "border-brand-200 bg-brand-50/50"
                          }`}
                          onClick={() => {
                            if (!notification.readAt) {
                              void markAsRead(notification.id);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">
                              {notification.subject}
                            </p>
                            {!notification.readAt ? (
                              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-brand-500" />
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-slate-600">
                            {notification.message}
                          </p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.16em] text-slate-400">
                            {formatNotificationTimestamp(notification.createdAt)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-center text-sm text-slate-500">
                        No notifications yet.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
