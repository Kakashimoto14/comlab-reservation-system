import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm, type FieldPath, type SubmitErrorHandler } from "react-hook-form";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { useAuth } from "../../store/AuthContext";
import { applyServerValidationErrors } from "../../utils/formErrors";
import {
  buildStudentRegistrationSchema,
  getFormattedStudentNumberInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  YEAR_LEVEL_OPTIONS
} from "../../utils/userValidation";

const registerSchema = buildStudentRegistrationSchema();

type RegisterFormValues = z.infer<typeof registerSchema>;

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
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [registrationState, setRegistrationState] = useState<{
    email: string;
    message: string;
    previewVerificationUrl?: string;
  } | null>(null);
  const {
    register,
    control,
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
      yearLevel: "2"
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

  const onSubmit = async (values: RegisterFormValues) => {
    setFormErrorMessage(null);

    try {
      const response = await registerUser(values);
      setRegistrationState({
        email: values.email,
        message: response.message,
        previewVerificationUrl: response.previewVerificationUrl
      });
      toast.success(response.message);
    } catch (error) {
      const message = applyServerValidationErrors(error, { setError, setFocus });
      setFormErrorMessage(message ?? "Registration failed. Please review your details.");
      toast.error(message ?? "Registration failed. Please review your details.");
    }
  };

  const onInvalid: SubmitErrorHandler<RegisterFormValues> = (formErrors) => {
    const firstField = Object.keys(formErrors)[0] as FieldPath<RegisterFormValues> | undefined;

    if (firstField) {
      setFocus(firstField);
    }

    const firstErrorMessage = Object.values(formErrors).find(
      (error): error is { message?: string } => Boolean(error?.message)
    )?.message;

    setFormErrorMessage(firstErrorMessage ?? "Please review the highlighted fields.");
  };

  if (registrationState) {
    return (
      <Card className="w-full max-w-xl">
        <div className="space-y-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
              Registration Complete
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
              Verify your email before logging in
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {registrationState.message} We sent the verification link to{" "}
              <span className="font-semibold text-slate-900">{registrationState.email}</span>.
            </p>
          </div>

          {registrationState.previewVerificationUrl ? (
            <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900">
              <p>This environment is using email preview mode.</p>
              <a
                className="mt-2 inline-flex font-semibold text-brand-700 underline"
                href={registrationState.previewVerificationUrl}
              >
                Open verification page
              </a>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button fullWidth onClick={() => navigate("/login", { replace: true, state: registrationState })}>
              Go to Login
            </Button>
            <Button
              type="button"
              variant="secondary"
              fullWidth
              onClick={() => setRegistrationState(null)}
            >
              Register Another Account
            </Button>
          </div>
        </div>
      </Card>
    );
  }

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
          <Controller
            name="firstName"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                autoComplete="given-name"
                inputMode="text"
                maxLength={50}
                onChange={(event) => field.onChange(sanitizeNameInput(event.target.value))}
              />
            )}
          />
        </FormField>
        <FormField label="Last Name" error={errors.lastName?.message}>
          <Controller
            name="lastName"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                autoComplete="family-name"
                inputMode="text"
                maxLength={50}
                onChange={(event) => field.onChange(sanitizeNameInput(event.target.value))}
              />
            )}
          />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input
            autoComplete="email"
            inputMode="email"
            type="email"
            {...register("email")}
          />
        </FormField>
        <FormField label="Student Number" error={errors.studentNumber?.message}>
          <Controller
            name="studentNumber"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                inputMode="numeric"
                maxLength={8}
                placeholder="24-12345"
                onChange={(event) => {
                  const input = event.currentTarget;
                  const selectionStart = input.selectionStart ?? input.value.length;
                  const nextValue = getFormattedStudentNumberInput(input.value, selectionStart);

                  field.onChange(nextValue.value);
                  requestAnimationFrame(() => {
                    input.setSelectionRange(nextValue.cursor, nextValue.cursor);
                  });
                }}
              />
            )}
          />
        </FormField>
        <FormField label="Department" error={errors.department?.message}>
          <Input autoComplete="organization" maxLength={120} {...register("department")} />
        </FormField>
        <FormField label="Year Level" error={errors.yearLevel?.message}>
          <Select {...register("yearLevel")}>
            {YEAR_LEVEL_OPTIONS.map((option) => (
              <option key={option} value={option}>
                Year {option}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Phone Number" error={errors.phone?.message}>
          <Controller
            name="phone"
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                value={field.value ?? ""}
                autoComplete="tel"
                inputMode="tel"
                maxLength={13}
                placeholder="09123456789"
                onChange={(event) => field.onChange(sanitizePhoneInput(event.target.value))}
              />
            )}
          />
        </FormField>
        <FormField label="Password" error={errors.password?.message}>
          <div className="space-y-3">
            <Input autoComplete="new-password" type="password" {...register("password")} />
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
        {formErrorMessage ? (
          <div
            className="md:col-span-2 rounded-2xl border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
            role="alert"
          >
            {formErrorMessage}
          </div>
        ) : null}
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
