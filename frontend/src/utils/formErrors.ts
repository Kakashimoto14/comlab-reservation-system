import { AxiosError } from "axios";
import type { FieldPath, FieldValues, UseFormSetError, UseFormSetFocus } from "react-hook-form";

export type ValidationErrorResponse<TFieldName extends string = string> = {
  message?: string;
  errors?: Partial<Record<TFieldName | "form", string[]>>;
};

export const applyServerValidationErrors = <TFieldValues extends FieldValues>(
  error: unknown,
  options: {
    setError: UseFormSetError<TFieldValues>;
    setFocus?: UseFormSetFocus<TFieldValues>;
  }
) => {
  const response = (error as AxiosError<ValidationErrorResponse>).response?.data;
  const fieldEntries = Object.entries(response?.errors ?? {}) as Array<[string, string[]]>;

  for (const [field, messages] of fieldEntries) {
    if (field === "form" || !messages?.length) {
      continue;
    }

    options.setError(field as FieldPath<TFieldValues>, {
      type: "server",
      message: messages[0]
    });
  }

  const firstField = fieldEntries.find(([field, messages]) => field !== "form" && messages?.length)?.[0];

  if (firstField && options.setFocus) {
    options.setFocus(firstField as FieldPath<TFieldValues>);
  }

  return response?.message;
};
