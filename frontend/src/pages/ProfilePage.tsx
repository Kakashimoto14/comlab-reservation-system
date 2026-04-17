import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { userApi } from "../api/services";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { FormField } from "../components/ui/FormField";
import { Input } from "../components/ui/Input";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../store/AuthContext";
import { roleLabels } from "../utils/constants";

const profileSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  department: z.string().optional(),
  yearLevel: z.coerce.number().min(1).max(6).optional(),
  phone: z.string().optional()
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export const ProfilePage = () => {
  const { user, setCurrentUser } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema)
  });

  useEffect(() => {
    if (user) {
      reset({
        firstName: user.firstName,
        lastName: user.lastName,
        department: user.department ?? "",
        yearLevel: user.yearLevel ?? undefined,
        phone: user.phone ?? ""
      });
    }
  }, [reset, user]);

  const mutation = useMutation({
    mutationFn: (values: ProfileFormValues) => userApi.updateProfile(values),
    onSuccess: (updatedUser) => {
      setCurrentUser(updatedUser);
      toast.success("Profile updated successfully.");
    },
    onError: () => toast.error("Unable to update profile.")
  });

  const onSubmit = async (values: ProfileFormValues) => {
    await mutation.mutateAsync(values);
  };

  return (
    <div>
      <PageHeader
        title="Profile Settings"
        description="Keep your account information updated for reservation requests and approvals."
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
                <Input {...register("firstName")} />
              </FormField>
              <FormField label="Last Name" error={errors.lastName?.message}>
                <Input {...register("lastName")} />
              </FormField>
              <FormField label="Department" error={errors.department?.message}>
                <Input {...register("department")} />
              </FormField>
              <FormField label="Year Level" error={errors.yearLevel?.message}>
                <Input type="number" {...register("yearLevel", { valueAsNumber: true })} />
              </FormField>
            </div>
            <FormField label="Phone Number" error={errors.phone?.message}>
              <Input {...register("phone")} />
            </FormField>
            <Button type="submit" disabled={isSubmitting || mutation.isPending}>
              {isSubmitting || mutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
