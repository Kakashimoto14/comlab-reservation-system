import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useEffect, useMemo } from "react";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { authApi, userApi } from "../api/services";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { Select } from "../components/ui/Select";
import { useAuth } from "../store/AuthContext";
import { applyServerValidationErrors } from "../utils/formErrors";
import { roleLabels } from "../utils/constants";
import {
  buildProfileSchema,
  passwordSchema,
  sanitizeNameInput,
  sanitizePhoneInput,
  YEAR_LEVEL_OPTIONS
} from "../utils/userValidation";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Confirm your new password.")
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match."
  });

type ProfileFormValues = z.infer<ReturnType<typeof buildProfileSchema>>;
type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;
type ProfileUpdatePayload = {
  firstName: string;
  lastName: string;
  department?: string | null;
  yearLevel?: number | null;
  phone?: string | null;
};

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage
    );
  }

  return fallbackMessage;
};

export const ProfilePage = () => {
  const { user, setCurrentUser } = useAuth();
  const isStudent = user?.role === "STUDENT";
  const profileSchema = useMemo(
    () => buildProfileSchema(user?.role),
    [user?.role]
  );
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    mode: "onChange"
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: {
      errors: passwordErrors,
      isSubmitting: isChangingPassword
    }
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema)
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department ?? "",
        yearLevel: user.yearLevel ? String(user.yearLevel) as ProfileFormValues["yearLevel"] : undefined,
        phone: user.phone ?? ""
      });
    }
  }, [reset, user]);

  const profileMutation = useMutation({
    mutationFn: (values: ProfileUpdatePayload) => userApi.updateProfile(values),
    onSuccess: (updatedUser) => {
      setCurrentUser(updatedUser);
      toast.success("Profile updated successfully.");
    },
    onError: (error) => {
      const message = applyServerValidationErrors(error, { setError, setFocus });
      toast.error(message ?? getErrorMessage(error, "Unable to update profile."));
    }
  });

  const changePasswordMutation = useMutation({
    mutationFn: (values: ChangePasswordFormValues) =>
      authApi.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword
      }),
    onSuccess: (response) => {
      resetPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      toast.success(response.message);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Unable to change password right now."))
  });

  const onSubmit = async (values: ProfileFormValues) => {
    await profileMutation.mutateAsync({
      firstName: values.firstName,
      lastName: values.lastName,
      department: values.department ?? null,
      phone: values.phone ?? null,
      yearLevel: isStudent ? (values.yearLevel ? Number(values.yearLevel) : null) : null
    });
  };

  const onPasswordSubmit = async (values: ChangePasswordFormValues) => {
    await changePasswordMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profile Settings"
        description="Keep your account details updated and manage your login credentials securely."
      />

      <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
        <Card>
          <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Account Summary</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-900">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="mt-2 text-sm text-slate-500">{user?.email}</p>
          <div className="mt-6 space-y-3 text-sm text-slate-600">
            <p>Role: {user?.role ? roleLabels[user.role] : "-"}</p>
            <p>Status: {user?.status}</p>
            {user?.studentNumber ? <p>Student Number: {user.studentNumber}</p> : null}
          </div>
        </Card>

        <Card>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-5 md:grid-cols-2">
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
              <FormField label="Department" error={errors.department?.message}>
                <Input autoComplete="organization" maxLength={120} {...register("department")} />
              </FormField>
              {isStudent ? (
                <FormField label="Year Level" error={errors.yearLevel?.message}>
                  <Select {...register("yearLevel")}>
                    <option value="">Select year level</option>
                    {YEAR_LEVEL_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        Year {option}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}
            </div>
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
            <Button type="submit" fullWidth disabled={isSubmitting || profileMutation.isPending}>
              {isSubmitting || profileMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Card>
      </div>

      <Card>
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-slate-900">Change Password</h2>
          <p className="mt-2 text-sm text-slate-500">
            Update your password regularly to keep your account secure.
          </p>
        </div>

        <form className="grid gap-5 lg:grid-cols-3" onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
          <FormField label="Current Password" error={passwordErrors.currentPassword?.message}>
            <Input type="password" {...registerPassword("currentPassword")} />
          </FormField>
          <FormField label="New Password" error={passwordErrors.newPassword?.message}>
            <Input type="password" {...registerPassword("newPassword")} />
          </FormField>
          <FormField label="Confirm Password" error={passwordErrors.confirmPassword?.message}>
            <Input type="password" {...registerPassword("confirmPassword")} />
          </FormField>
          <div className="md:col-span-3">
            <Button
              type="submit"
              fullWidth
              disabled={isChangingPassword || changePasswordMutation.isPending}
            >
              {isChangingPassword || changePasswordMutation.isPending
                ? "Updating password..."
                : "Change Password"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
