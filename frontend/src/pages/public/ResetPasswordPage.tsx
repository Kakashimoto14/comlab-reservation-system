import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { authApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { passwordSchema } from "../../utils/userValidation";

const resetPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string().min(10, "Confirm your new password.")
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const defaultValues = useMemo(
    () => ({
      password: "",
      confirmPassword: ""
    }),
    []
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!token) {
      toast.error("This reset link is incomplete. Request a new one.");
      return;
    }

    try {
      const response = await authApi.resetPassword({
        token,
        newPassword: values.password
      });
      toast.success(response.message);
      setSuccessMessage(response.message);
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>).response?.data?.message ??
        "Unable to reset your password.";
      toast.error(message);
    }
  };

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <EmptyState
          title="Invalid reset link"
          description="The password reset token is missing. Request a new reset link to continue."
        />
      </Card>
    );
  }

  if (successMessage) {
    return (
      <Card className="w-full max-w-md">
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
              Password Updated
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
              Your account is ready
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{successMessage}</p>
          </div>

          <Link to="/login" className="block">
            <Button fullWidth>Back to Login</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
          Reset Password
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
          Choose a new password
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Enter a new password for your ComPort account.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="New Password" error={errors.password?.message}>
          <Input type="password" {...register("password")} />
        </FormField>
        <FormField label="Confirm Password" error={errors.confirmPassword?.message}>
          <Input type="password" {...register("confirmPassword")} />
        </FormField>

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Updating password..." : "Reset Password"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        Need another link?{" "}
        <Link className="font-semibold text-brand-700" to="/forgot-password">
          Request a new reset link
        </Link>
      </p>
    </Card>
  );
};
