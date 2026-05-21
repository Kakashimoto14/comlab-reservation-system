<<<<<<< HEAD
import { Bell, CalendarDays, LogOut, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
=======
import { Bell, CalendarDays, LogOut, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
>>>>>>> codex/PHASE_2_UI_UX
import { useLocation } from "react-router-dom";

import { useAuth } from "../../store/AuthContext";
import { APP_SHORT_NAME, roleLabels } from "../../utils/constants";
import { NotificationCenter } from "./NotificationCenter";

const routeMeta = [
  { match: "/student/dashboard", title: "Student Dashboard", description: "Track your booking activity and latest reservation updates." },
  { match: "/student/laboratories", title: "Reserve Laboratory", description: "Choose a laboratory, review available schedules, and submit your reservation request." },
  { match: "/student/reservations", title: "Reservation History", description: "Review your requests, status changes, and staff remarks." },
  { match: "/assistant", title: "ComPort GPT", description: "Ask about live schedules, reservations, laboratories, and safe system actions." },
  { match: "/dashboard", title: "Operations Dashboard", description: "Monitor reservation volume, approval queues, and laboratory usage." },
  { match: "/management/users", title: "User Administration", description: "Manage access, roles, and account status across the system." },
  { match: "/management/laboratories/assign-staff", title: "Staff Assignment", description: "Coordinate laboratory staff coverage and room access responsibilities." },
  { match: "/management/laboratories", title: "Laboratory Administration", description: "Maintain rooms, capacities, media, and availability status." },
  { match: "/management/calendar", title: "Management Calendar", description: "Review reservation schedules and operational availability by date." },
  { match: "/management/schedules", title: "Schedule Administration", description: "Publish reservation slots and prevent schedule conflicts." },
  { match: "/management/reservations", title: "Reservation Workflow", description: "Review pending requests and complete reservation decisions." },
  { match: "/management/reports", title: "Reports and Insights", description: "Review utilization, trends, and exportable reservation data." },
  { match: "/laboratory-guide", title: "Laboratory Guide", description: "Browse laboratory spaces, capacity details, and available room information." },
  { match: "/profile", title: "Account Settings", description: "Update your profile details and password securely." }
];

export const Topbar = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isAssistantRoute = location.pathname.startsWith("/assistant");

  const currentRoute = useMemo(
    () =>
      routeMeta.find((item) =>
        item.match === "/dashboard"
          ? location.pathname === item.match
          : location.pathname.startsWith(item.match)
      ) ?? {
        title: `${APP_SHORT_NAME} Workspace`,
        description: "Manage laboratory reservations with clarity and accountability."
      },
    [location.pathname]
  );

  const formattedToday = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      }).format(new Date()),
    []
  );

  return (
    <div
      className={
        isAssistantRoute
          ? "mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-soft sm:px-5"
          : "mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-soft sm:px-5 lg:px-6"
      }
    >
      <div className={isAssistantRoute ? "flex flex-col gap-3" : "flex flex-col gap-5"}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className={isAssistantRoute ? "mb-2 flex items-center gap-3" : "mb-3 flex items-center gap-3"}>
              <img
                src="/comport-logo.png"
                alt="ComPort logo"
                className={
                  isAssistantRoute
                    ? "h-9 w-9 rounded-2xl border border-slate-200 bg-white object-cover p-1"
                    : "h-10 w-10 rounded-2xl border border-slate-200 bg-white object-cover p-1"
                }
              />
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                {APP_SHORT_NAME}
              </p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              {currentRoute.title}
            </p>
            <p className={isAssistantRoute ? "mt-1.5 max-w-3xl text-sm leading-6 text-slate-600" : "mt-2 max-w-3xl text-sm leading-6 text-slate-600"}>
              {currentRoute.description}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 lg:justify-end">
            <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:px-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user?.firstName} {user?.lastName}
                </p>
                <p className="truncate text-xs font-medium text-slate-500">
                  {user ? roleLabels[user.role] : "Authenticated User"}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <NotificationCenter />

              <button
                type="button"
<<<<<<< HEAD
                aria-label="Logout"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 xl:w-auto xl:px-4"
                onClick={logout}
=======
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                className="relative rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-50"
                onClick={() => setNotificationsOpen((current) => !current)}
>>>>>>> codex/PHASE_2_UI_UX
              >
                <LogOut className="h-4 w-4 xl:mr-2" />
                <span className="hidden text-sm font-semibold xl:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

<<<<<<< HEAD
        <div
          className={
            isAssistantRoute
              ? "flex flex-wrap gap-2 border-t border-slate-100 pt-3"
              : "grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"
          }
        >
          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
            <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Today
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                {formattedToday}
              </p>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
            <Bell className="h-4 w-4 shrink-0 text-brand-600" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                Updates
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                Notification center
              </p>
=======
              {notificationsOpen ? (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[1px] sm:hidden"
                    onClick={() => setNotificationsOpen(false)}
                  />

                  <div className="fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200 bg-white shadow-soft sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-3 sm:max-h-none sm:w-[23rem] sm:rounded-3xl">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Notifications</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {unreadCount
                            ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                            : "You're all caught up."}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-700 disabled:text-slate-300"
                          disabled={!unreadCount || isMarkingAllAsRead}
                          onClick={() => void markAllAsRead()}
                        >
                          Mark all read
                        </button>
                        <button
                          type="button"
                          aria-label="Close notifications"
                          className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                          onClick={() => setNotificationsOpen(false)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:max-h-[28rem]">
                      {isLoading ? (
                        Array.from({ length: 3 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-24 animate-pulse rounded-2xl bg-slate-100"
                          />
                        ))
                      ) : items.length ? (
                        items.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            className={`block w-full rounded-2xl border px-4 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50/60 ${
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
                              <p className="text-sm font-semibold leading-6 text-slate-900">
                                {notification.subject}
                              </p>
                              {!notification.readAt ? (
                                <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand-500" />
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
                        <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                          No notifications yet.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
>>>>>>> codex/PHASE_2_UI_UX
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
