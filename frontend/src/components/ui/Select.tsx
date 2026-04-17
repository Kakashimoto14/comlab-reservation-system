import clsx from "clsx";
import type { SelectHTMLAttributes } from "react";

export const Select = ({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={clsx(
      "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:shadow-soft",
      className
    )}
    {...props}
  />
);
