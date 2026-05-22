import { AlertTriangle, CalendarCheck2, CalendarOff, Clock3 } from "lucide-react";

import type { CalendarSyncStatus } from "../../types/api";

type CalendarSyncStatusBadgeProps = {
  status?: CalendarSyncStatus | null;
  compact?: boolean;
};

const statusConfig = {
  SYNCED: {
    label: "Calendar synced",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: CalendarCheck2
  },
  FAILED: {
    label: "Calendar sync failed",
    className: "border-rose-200 bg-rose-50 text-rose-700",
    icon: AlertTriangle
  },
  DISABLED: {
    label: "Calendar disabled",
    className: "border-slate-200 bg-slate-50 text-slate-600",
    icon: CalendarOff
  },
  NOT_ATTEMPTED: {
    label: "Calendar not synced",
    className: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Clock3
  }
} satisfies Record<CalendarSyncStatus, { label: string; className: string; icon: typeof Clock3 }>;

export const CalendarSyncStatusBadge = ({
  status,
  compact = false
}: CalendarSyncStatusBadgeProps) => {
  const config = statusConfig[status ?? "NOT_ATTEMPTED"];

  if ((status ?? "NOT_ATTEMPTED") === "DISABLED") {
    return null;
  }

  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.className}`}
      title={config.label}
    >
      <Icon className="h-3.5 w-3.5" />
      {compact ? config.label.replace("Calendar ", "") : config.label}
    </span>
  );
};
