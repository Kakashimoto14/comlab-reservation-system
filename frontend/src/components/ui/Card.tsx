import clsx from "clsx";
import type { HTMLAttributes, PropsWithChildren } from "react";

export const Card = ({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={clsx(
      "rounded-xl border border-slate-200/80 bg-white p-5 shadow-soft sm:p-6",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
