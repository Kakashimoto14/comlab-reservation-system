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
  <div className="mb-6 flex flex-col gap-4 sm:mb-8 lg:flex-row lg:items-end lg:justify-between">
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
    </div>
    {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
  </div>
);
