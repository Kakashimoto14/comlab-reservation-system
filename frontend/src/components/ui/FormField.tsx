import type { PropsWithChildren } from "react";

export const FormField = ({
  label,
  error,
  children
}: PropsWithChildren<{
  label: string;
  error?: string;
}>) => (
  <label className="block space-y-2">
    <span className="text-sm font-medium text-slate-700">{label}</span>
    {children}
    {error ? <span className="text-xs text-danger">{error}</span> : null}
  </label>
);
