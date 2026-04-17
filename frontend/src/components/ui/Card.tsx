import clsx from "clsx";
import type { HTMLAttributes, PropsWithChildren } from "react";

export const Card = ({
  children,
  className,
  ...props
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) => (
  <div
    className={clsx(
      "rounded-3xl border border-slate-200 bg-white p-6 shadow-soft",
      className
    )}
    {...props}
  >
    {children}
  </div>
);
