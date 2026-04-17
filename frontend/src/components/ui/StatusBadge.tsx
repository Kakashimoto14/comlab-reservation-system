import clsx from "clsx";

import type { LaboratoryStatus, ReservationStatus, ScheduleStatus, UserStatus } from "../../types/api";

type Status = ReservationStatus | LaboratoryStatus | ScheduleStatus | UserStatus;

const statusStyles: Record<Status, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-rose-100 text-rose-800",
  CANCELLED: "bg-slate-200 text-slate-700",
  COMPLETED: "bg-teal-100 text-teal-800",
  AVAILABLE: "bg-emerald-100 text-emerald-800",
  UNAVAILABLE: "bg-slate-200 text-slate-700",
  MAINTENANCE: "bg-orange-100 text-orange-700",
  BLOCKED: "bg-orange-100 text-orange-700",
  CLOSED: "bg-slate-200 text-slate-700",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  DEACTIVATED: "bg-rose-100 text-rose-800"
};

export const StatusBadge = ({ status }: { status: Status }) => (
  <span
    className={clsx(
      "inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide",
      statusStyles[status]
    )}
  >
    {status.replace("_", " ")}
  </span>
);
