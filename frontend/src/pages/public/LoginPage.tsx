import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
      toast.error(message);
    }
  };

  const resetSession = () => {
    logout();
    toast.success("Saved session cleared. You can log in again.");
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
          Use your registered account or demo credentials to continue.
        </p>
      </div>

      <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
        <FormField label="Email" error={errors.email?.message}>
          <Input type="email" {...register("email")} />
        </FormField>

        <FormField label="Password" error={errors.password?.message}>
          <Input type="password" {...register("password")} />
        </FormField>

        <Button type="submit" fullWidth disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Login"}
        </Button>
      </form>

      <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">
        <p className="font-semibold text-slate-700">Demo quick access</p>
        <p className="mt-2">Admin: `admin@comlab.edu` / `Password123!`</p>
        <p>Staff: `staff@comlab.edu` / `Password123!`</p>
      </div>

      <div className="mt-4">
        <Button type="button" variant="secondary" fullWidth onClick={resetSession}>
          Reset Saved Session
        </Button>
      </div>

      <p className="mt-6 text-sm text-slate-500">
        No account yet?{" "}
        <Link className="font-semibold text-brand-700" to="/register">
          Register as a student
        </Link>
      </p>
    </Card>
  );
};
