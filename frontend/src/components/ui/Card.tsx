import clsx from "clsx";
import type { HTMLAttributes, PropsWithChildren } from "react";

export const Card = ({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={clsx(
      "overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-soft sm:p-6",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
