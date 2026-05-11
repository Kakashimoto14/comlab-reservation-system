import { Bell, CalendarDays, LogOut, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../store/AuthContext";
import { roleLabels } from "../../utils/constants";
import { NotificationCenter } from "./NotificationCenter";

const routeMeta = [
  { match: "/student/dashboard", title: "Student Dashboard", description: "Track your booking activity and latest reservation updates." },
  { match: "/student/laboratories", title: "Laboratory Catalog", description: "Browse available laboratories, schedules, and reservation windows." },
  { match: "/student/reservations", title: "Reservation History", description: "Review your requests, status changes, and staff remarks." },
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
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-soft sm:px-5 lg:px-6">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
              {currentRoute.title}
            </p>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
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
                aria-label="Logout"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 xl:w-auto xl:px-4"
                onClick={logout}
              >
                <LogOut className="h-4 w-4 xl:mr-2" />
                <span className="hidden text-sm font-semibold xl:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
