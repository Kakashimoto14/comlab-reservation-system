import { zodResolver } from "@hookform/resolvers/zod";
import type { AxiosError } from "axios";
import { useEffect } from "react";
import { useForm, type FieldPath, type SubmitErrorHandler } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../store/AuthContext";

const registerSchema = z.object({
  firstName: z.string().trim().min(2, "First name must be at least 2 characters."),
  lastName: z.string().trim().min(2, "Last name must be at least 2 characters."),
  email: z.string().email("Enter a valid email address."),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters.")
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/\d/, "Password must include a number.")
    .regex(/[^A-Za-z0-9]/, "Password must include a special character."),
  studentNumber: z.string().trim().min(6, "Student number must be at least 6 characters."),
  department: z.string().trim().min(2, "Department must be at least 2 characters."),
  yearLevel: z.coerce.number().min(1).max(6),
  phone: z.string().trim().min(7, "Phone number must be at least 7 characters.")
});

type RegisterFormValues = z.infer<typeof registerSchema>;
type ValidationErrorResponse = {
  message?: string;
  errors?: Partial<Record<keyof RegisterFormValues | "form", string[]>>;
};

const passwordRuleLabels = [
  { key: "length", label: "At least 10 characters", test: (value: string) => value.length >= 10 },
  { key: "upper", label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { key: "lower", label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { key: "number", label: "One number", test: (value: string) => /\d/.test(value) },
  {
    key: "special",
    label: "One special character",
    test: (value: string) => /[^A-Za-z0-9]/.test(value)
  }
] as const;

export const RegisterPage = () => {
  const navigate = useNavigate();
  const { register: registerUser, user } = useAuth();
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      department: "BS Information Technology",
      yearLevel: 2
    }
  });

  useEffect(() => {
    if (!user) {
      return;
    }

    navigate(user.role === "STUDENT" ? "/student/dashboard" : "/dashboard", {
      replace: true
    });
  }, [navigate, user]);

  const password = watch("password", "");
  const passwordRules = passwordRuleLabels.map((rule) => ({
    ...rule,
    satisfied: rule.test(password)
  }));

  const focusFirstField = (fields: Array<keyof RegisterFormValues | "form">) => {
    const firstField = fields.find((field) => field !== "form") as FieldPath<RegisterFormValues> | undefined;

    if (firstField) {
      setFocus(firstField);
    }
  };

  const onSubmit = async (values: RegisterFormValues) => {
    try {
      await registerUser(values);
      toast.success("Student account created successfully.");
      navigate("/student/dashboard", { replace: true });
    } catch (error) {
      const response = (error as AxiosError<ValidationErrorResponse>).response?.data;
      const fieldEntries = Object.entries(response?.errors ?? {}) as Array<
        [keyof RegisterFormValues | "form", string[]]
      >;

      for (const [field, messages] of fieldEntries) {
        if (field === "form" || !messages?.length) {
          continue;
        }

        setError(field, {
          type: "server",
          message: messages[0]
        });
      }

      focusFirstField(fieldEntries.map(([field]) => field));
      toast.error(response?.message ?? "Registration failed. Please review your details.");
    }
  };

  const onInvalid: SubmitErrorHandler<RegisterFormValues> = (formErrors) => {
    const firstField = Object.keys(formErrors)[0] as FieldPath<RegisterFormValues> | undefined;

    if (firstField) {
      setFocus(firstField);
    }
  };

  return (
    <Card className="w-full max-w-xl">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
          Student Registration
        </p>
        <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
          Create a laboratory reservation account
        </h2>
      </div>

      <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmit, onInvalid)}>
        <FormField label="First Name" error={errors.firstName?.message}>
          <Input aria-invalid={Boolean(errors.firstName)} {...register("firstName")} />
        </FormField>
        <FormField label="Last Name" error={errors.lastName?.message}>
          <Input aria-invalid={Boolean(errors.lastName)} {...register("lastName")} />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input aria-invalid={Boolean(errors.email)} type="email" {...register("email")} />
        </FormField>
        <FormField label="Student Number" error={errors.studentNumber?.message}>
          <Input aria-invalid={Boolean(errors.studentNumber)} {...register("studentNumber")} />
        </FormField>
        <FormField label="Department" error={errors.department?.message}>
          <Input aria-invalid={Boolean(errors.department)} {...register("department")} />
        </FormField>
        <FormField label="Year Level" error={errors.yearLevel?.message}>
          <Input
            aria-invalid={Boolean(errors.yearLevel)}
            type="number"
            min={1}
            max={6}
            {...register("yearLevel", { valueAsNumber: true })}
          />
        </FormField>
        <FormField label="Phone Number" error={errors.phone?.message}>
          <Input aria-invalid={Boolean(errors.phone)} {...register("phone")} />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <div className="space-y-3">
            <Input aria-invalid={Boolean(errors.password)} type="password" {...register("password")} />
            <div className="grid gap-2 text-xs text-slate-500">
              {passwordRules.map((rule) => (
                <span
                  key={rule.key}
                  className={rule.satisfied ? "text-emerald-700" : "text-slate-500"}
                >
                  {rule.label}
                </span>
              ))}
            </div>
          </div>
        </FormField>
        <div className="md:col-span-2">
          <Button type="submit" fullWidth disabled={isSubmitting}>
            {isSubmitting ? "Creating account..." : "Register Student"}
          </Button>
        </div>
      </form>

      <p className="mt-6 text-sm text-slate-500">
        Already have an account?{" "}
        <Link className="font-semibold text-brand-700" to="/login">
          Login here
        </Link>
      </p>
    </Card>
  );
};
