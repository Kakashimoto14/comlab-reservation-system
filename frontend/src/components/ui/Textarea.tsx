import clsx from "clsx";
import type { TextareaHTMLAttributes } from "react";

export const Textarea = ({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea
    className={clsx(
      "min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:shadow-soft",
      className
    )}
    {...props}
  />
);
