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
  <Card className="bg-gradient-to-br from-white to-brand-50">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <h3 className="mt-3 text-3xl font-bold text-slate-900">{value}</h3>
        <p className="mt-2 text-sm text-slate-500">{helper}</p>
      </div>
      <div className="rounded-2xl bg-brand-700/10 p-3 text-brand-700">
        <Icon className="h-6 w-6" />
      </div>
    </div>
  </Card>
);
