import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { useForm, type SubmitErrorHandler } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";

import { useAuth } from "../../store/AuthContext";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters.")
});

type LoginFormValues = z.infer<typeof loginSchema>;

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, logout, user } = useAuth();
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema)
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    navigate(user.role === "STUDENT" ? "/student/dashboard" : "/dashboard", {
      replace: true
    });
  }, [navigate, user]);

  const onSubmit = async (values: LoginFormValues) => {
    setFormErrorMessage(null);

    try {
      const response = await login(values);
      toast.success("Welcome back.");
      const target =
        (location.state as { from?: { pathname?: string } } | undefined)?.from?.pathname ??
        (response.user.role === "STUDENT" ? "/student/dashboard" : "/dashboard");
      navigate(target, { replace: true });
    } catch (error) {
      const message =
        (error as AxiosError<{ message?: string }>).response?.data?.message ??
        "Login failed. Please check your credentials.";
      setFormErrorMessage(message);
      toast.error(message);
    }
  };

  const onInvalid: SubmitErrorHandler<LoginFormValues> = (formErrors) => {
    const firstErrorMessage = Object.values(formErrors).find(
      (error): error is { message?: string } => Boolean(error?.message)
    )?.message;

    setFormErrorMessage(firstErrorMessage ?? "Please review the highlighted fields.");
  };

  const resetSession = () => {
    logout();
    toast.success("Current session cleared. You can log in again.");
    navigate("/login", { replace: true });
  };

  return (
    <Card className="w-full max-w-md">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
          User Login
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
          Access your reservation portal
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Use your registered account to continue securely.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" inputMode="email" autoComplete="email" {...register("email")} />
        </FormField>

        <FormField label="Password" error={errors.password?.message}>
          <Input type="password" autoComplete="current-password" {...register("password")} />
        </FormField>

        {formErrorMessage ? (
          <div
            className="rounded-2xl border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {formErrorMessage}
          </div>
        ) : null}

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Login"}
        </Button>
      </form>

      <div className="mt-4">
        <Button type="button" variant="secondary" fullWidth onClick={resetSession}>
          Clear Active Session
        </Button>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        No account yet?{" "}
        <Link className="font-semibold text-brand-700" to="/register">
          Register as a student
        </Link>
      </p>
      <p className="mt-3 text-sm text-slate-500">
        Forgot your password?{" "}
        <Link className="font-semibold text-brand-700" to="/forgot-password">
          Reset it here
        </Link>
      </p>
    </Card>
  );
};
