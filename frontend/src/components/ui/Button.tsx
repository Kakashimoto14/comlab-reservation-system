import clsx from "clsx";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type ButtonProps = PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "outline" | "danger";
    fullWidth?: boolean;
  }
>;

const variants = {
  primary: "bg-brand-700 text-white hover:bg-brand-800",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200",
  outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "bg-danger text-white hover:bg-red-800"
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, variant = "primary", fullWidth, ...props }, ref) => (
    <button
      ref={ref}
      className={clsx(
        "inline-flex min-h-11 min-w-0 items-center justify-center rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 whitespace-normal break-words sm:whitespace-nowrap",
        variants[variant],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = "Button";
