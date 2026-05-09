import clsx from "clsx";
import type { InputHTMLAttributes } from "react";

export const Input = ({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) => (
  <input
    className={clsx(
      "min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base text-slate-700 outline-none ring-0 transition placeholder:text-slate-400 focus:border-brand-400 focus:shadow-soft sm:text-sm",
      props["aria-invalid"] ? "border-danger bg-red-50/40 focus:border-danger" : undefined,
      className
    )}
    {...props}
  />
);
