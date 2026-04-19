import { Bell, CalendarDays, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { useLocation } from "react-router-dom";

import { useAuth } from "../../store/AuthContext";

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
  const { user } = useAuth();

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
              {user?.role.replace("_", " ")}
            </p>
          </div>

          <div className="flex items-center gap-3">
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
            <button className="rounded-2xl border border-slate-200 p-3 text-slate-500 transition hover:bg-slate-50">
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
