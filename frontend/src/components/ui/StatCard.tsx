import type { LucideIcon } from "lucide-react";

import { Card } from "./Card";

export const StatCard = ({
  title,
  value,
  helper,
  icon: Icon
}: {
  title: string;
  value: number;
  helper: string;
  icon: LucideIcon;
}) => (
  <Card className="bg-gradient-to-br from-white to-brand-50/80">
    <div className="flex min-h-28 items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500">{title}</p>
        <h3 className="mt-3 text-3xl font-bold leading-none text-slate-900">{value}</h3>
        <p className="mt-3 text-sm leading-5 text-slate-500">{helper}</p>
      </div>
      <div className="shrink-0 rounded-xl bg-brand-700/10 p-3 text-brand-700">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </Card>
);
