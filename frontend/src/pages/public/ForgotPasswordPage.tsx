import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { z } from "zod";

import { authApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";

const forgotPasswordSchema = z.object({
  email: z.string().email("Enter a valid email address.")
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const ForgotPasswordPage = () => {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema)
  });

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    try {
      const response = await authApi.forgotPassword(values);
      toast.success(response.message);

      if (response.previewResetUrl) {
        toast(
          <span>
            Demo reset link ready.{" "}
            <a
              className="font-semibold text-brand-700 underline"
              href={response.previewResetUrl}
            >
              Open reset page
            </a>
          </span>,
          { duration: 8000 }
        );
      }
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>).response?.data?.message ??
        "Unable to prepare a password reset link right now.";
      toast.error(message);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
          Password Recovery
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
          Reset your account password
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Enter your account email and we will prepare a reset link for you.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} />
        </FormField>

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Preparing link..." : "Send Reset Link"}
        </Button>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        Remembered your password?{" "}
        <Link className="font-semibold text-brand-700" to="/login">
          Back to login
        </Link>
      </p>
    </Card>
  );
};
