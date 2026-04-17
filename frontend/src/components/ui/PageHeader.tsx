import type { PropsWithChildren, ReactNode } from "react";

export const PageHeader = ({
  title,
  description,
  actions
}: PropsWithChildren<{
  title: string;
  description: string;
  actions?: ReactNode;
}>) => (
  <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <h1 className="font-display text-3xl font-bold text-slate-900">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>
    </div>
    {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
  </div>
);
