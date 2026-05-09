import clsx from "clsx";
import type { SelectHTMLAttributes } from "react";

export const Select = ({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select
    className={clsx(
      "min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-700 outline-none transition focus:border-brand-400 focus:shadow-soft sm:text-sm",
      className
    )}
    {...props}
  />
);
