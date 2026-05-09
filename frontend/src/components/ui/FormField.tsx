import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type PropsWithChildren,
  type ReactElement
} from "react";

export const FormField = ({
  label,
  error,
  children
}: PropsWithChildren<{
  label: string;
  error?: string;
}>) => {
  const inputId = useId();
  const errorId = useId();

  const child = Children.only(children);
  const canEnhanceChild =
    isValidElement(child) &&
    (typeof child.type !== "string" ||
      ["input", "select", "textarea"].includes(child.type));
  const childProps = canEnhanceChild ? (child.props as Record<string, unknown>) : null;
  const enhancedChild =
    canEnhanceChild
      ? cloneElement(child as ReactElement<Record<string, unknown>>, {
          id: (childProps?.id as string | undefined) ?? inputId,
          "aria-invalid": (childProps?.["aria-invalid"] as boolean | undefined) ?? Boolean(error),
          "aria-describedby": error
            ? [childProps?.["aria-describedby"], errorId].filter(Boolean).join(" ")
            : childProps?.["aria-describedby"]
        })
      : child;

  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {enhancedChild}
      {error ? (
        <span id={errorId} className="break-words text-xs text-danger" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
};
