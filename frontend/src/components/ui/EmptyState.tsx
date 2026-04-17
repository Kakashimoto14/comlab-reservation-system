import { Inbox } from "lucide-react";

export const EmptyState = ({
  title,
  description
}: {
  title: string;
  description: string;
}) => (
  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
    <Inbox className="mb-4 h-10 w-10 text-brand-500" />
    <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
    <p className="mt-2 max-w-md text-sm text-slate-500">{description}</p>
  </div>
);
