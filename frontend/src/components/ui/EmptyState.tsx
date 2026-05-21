import { Inbox } from "lucide-react";
import type { ReactNode } from "react";

export const EmptyState = ({
  title,
  description,
  action
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <Inbox className="mb-4 h-10 w-10 text-brand-500" />
    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
    <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
    {action ? <div className="mt-5 flex flex-wrap justify-center gap-3">{action}</div> : null}
  </div>
);
