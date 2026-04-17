import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { z } from "zod";

import { userApi } from "../../api/services";
import type { User, UserRole } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";

const userSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8).optional().or(z.literal("")),
  role: z.enum(["ADMIN", "STUDENT", "LABORATORY_STAFF"]),
  studentNumber: z.string().optional(),
  department: z.string().optional(),
  yearLevel: z.coerce.number().optional(),
  phone: z.string().optional()
});

type UserFormValues = z.infer<typeof userSchema>;

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage
    );
  }

  return fallbackMessage;
};

const sanitizeUserPayload = (values: UserFormValues, isEditing: boolean) => {
  const payload: Record<string, unknown> = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    role: values.role
  };

  if (values.department?.trim()) {
    payload.department = values.department.trim();
  }

  if (values.phone?.trim()) {
    payload.phone = values.phone.trim();
  }

  if (values.role === "STUDENT") {
    if (values.studentNumber?.trim()) {
      payload.studentNumber = values.studentNumber.trim();
    }

    if (typeof values.yearLevel === "number" && !Number.isNaN(values.yearLevel)) {
      payload.yearLevel = values.yearLevel;
    }
  }

  if (values.password?.trim()) {
    payload.password = values.password.trim();
  } else if (!isEditing) {
    payload.password = "";
  }

  return payload;
};

export const UserManagementPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: userApi.list
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      role: "STUDENT"
    }
  });

  const role = watch("role");

  useEffect(() => {
    if (selectedUser) {
      reset({
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        password: "",
        role: selectedUser.role,
        studentNumber: selectedUser.studentNumber ?? "",
        department: selectedUser.department ?? "",
        yearLevel: selectedUser.yearLevel ?? undefined,
        phone: selectedUser.phone ?? ""
      });
      return;
    }

    reset({
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      role: "STUDENT",
      studentNumber: "",
      department: "",
      yearLevel: undefined,
      phone: ""
    });
  }, [reset, selectedUser]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["users"] });
    setOpen(false);
    setSelectedUser(null);
  };

  const createMutation = useMutation({
    mutationFn: (values: UserFormValues) => userApi.create(values),
    onSuccess: async () => {
      toast.success("User account created.");
      await invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to create user account."))
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues) => userApi.update(selectedUser!.id, values),
    onSuccess: async () => {
      toast.success("User account updated.");
      await invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update user account."))
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "DEACTIVATED" }) =>
      userApi.updateStatus(id, status),
    onSuccess: async () => {
      toast.success("User status updated.");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update user status."))
  });

  const onSubmit = async (values: UserFormValues) => {
    const payload = sanitizeUserPayload(values, Boolean(selectedUser));

    if (selectedUser) {
      await updateMutation.mutateAsync(payload as UserFormValues);
      return;
    }

    if (!payload.password) {
      toast.error("Password is required for new users.");
      return;
    }

    await createMutation.mutateAsync(payload as UserFormValues & { password: string });
  };

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Create, edit, and deactivate platform users for demonstration-ready access control."
        actions={<Button onClick={() => setOpen(true)}>Add User</Button>}
      />

      <Card>
        {isLoading ? (
          <div>Loading users...</div>
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">User</th>
                  <th className="py-3 pr-4">Role</th>
                  <th className="py-3 pr-4">Department</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((user) => (
                  <tr key={user.id}>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="mt-1 text-slate-500">{user.email}</p>
                    </td>
                    <td className="py-4 pr-4">{user.role.replace("_", " ")}</td>
                    <td className="py-4 pr-4">
                      {user.department ?? "Not specified"}
                      {user.studentNumber ? (
                        <p className="mt-1 text-slate-500">{user.studentNumber}</p>
                      ) : null}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(user);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant={user.status === "ACTIVE" ? "danger" : "secondary"}
                          onClick={() =>
                            statusMutation.mutate({
                              id: user.id,
                              status:
                                user.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE"
                            })
                          }
                        >
                          {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No users available"
            description="Create staff or student accounts to populate this management module."
          />
        )}
      </Card>

      <Modal
        open={open}
        title={selectedUser ? "Edit User" : "Create User"}
        onClose={() => {
          setOpen(false);
          setSelectedUser(null);
        }}
      >
        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="First Name" error={errors.firstName?.message}>
            <Input {...register("firstName")} />
          </FormField>
          <FormField label="Last Name" error={errors.lastName?.message}>
            <Input {...register("lastName")} />
          </FormField>
          <FormField label="Email" error={errors.email?.message}>
            <Input type="email" {...register("email")} />
          </FormField>
          <FormField label="Password" error={errors.password?.message}>
            <Input
              type="password"
              placeholder={selectedUser ? "Leave blank to keep current password" : ""}
              {...register("password")}
            />
          </FormField>
          <FormField label="Role" error={errors.role?.message}>
            <Select {...register("role")}>
              {["ADMIN", "STUDENT", "LABORATORY_STAFF"].map((item) => (
                <option key={item} value={item}>
                  {item.replace("_", " ")}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Department" error={errors.department?.message}>
            <Input {...register("department")} />
          </FormField>
          {role === "STUDENT" ? (
            <>
              <FormField label="Student Number" error={errors.studentNumber?.message}>
                <Input {...register("studentNumber")} />
              </FormField>
              <FormField label="Year Level" error={errors.yearLevel?.message}>
                <Input type="number" {...register("yearLevel", { valueAsNumber: true })} />
              </FormField>
            </>
          ) : null}
          <FormField label="Phone Number" error={errors.phone?.message}>
            <Input {...register("phone")} />
          </FormField>
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setOpen(false);
                setSelectedUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || createMutation.isPending || updateMutation.isPending
              }
            >
              {selectedUser ? "Save Changes" : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
