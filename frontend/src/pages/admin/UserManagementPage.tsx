import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { SubmitErrorHandler } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { AxiosError } from "axios";
import toast from "react-hot-toast";
import { z } from "zod";

import { userApi } from "../../api/services";
import type { User } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { FormField } from "../../components/ui/FormField";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { applyServerValidationErrors } from "../../utils/formErrors";
import {
  buildManagedUserSchema,
  getFormattedStudentNumberInput,
  sanitizeNameInput,
  sanitizePhoneInput,
  YEAR_LEVEL_OPTIONS
} from "../../utils/userValidation";

const invalidUserFormMessage =
  "Please correct the highlighted fields before submitting the user form.";
const PAGE_SIZE = 10;

const userSchema = buildManagedUserSchema();

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
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    role: values.role
  };

  payload.department = values.department ?? null;
  payload.phone = values.phone ?? null;

  if (values.role === "STUDENT") {
    payload.studentNumber = values.studentNumber ?? null;
    payload.yearLevel = values.yearLevel ? Number(values.yearLevel) : null;
  } else {
    payload.studentNumber = null;
    payload.yearLevel = null;
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
  const [statusTargetUser, setStatusTargetUser] = useState<User | null>(null);
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: userApi.list,
    staleTime: 30_000
  });
  const users = data ?? [];
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return users.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, users]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    mode: "onChange",
    shouldUnregister: true,
    defaultValues: {
      role: "STUDENT"
    }
  });

  const role = watch("role");

  useEffect(() => {
    setFormErrorMessage(null);

    if (selectedUser) {
      reset({
        firstName: selectedUser.firstName,
        lastName: selectedUser.lastName,
        email: selectedUser.email,
        password: "",
        role: selectedUser.role,
        studentNumber: selectedUser.studentNumber ?? "",
        department: selectedUser.department ?? "",
        yearLevel: selectedUser.yearLevel ? String(selectedUser.yearLevel) as UserFormValues["yearLevel"] : undefined,
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

  useEffect(() => {
    if (role === "STUDENT") {
      return;
    }

    setValue("studentNumber", "", { shouldValidate: true, shouldDirty: true });
    setValue("yearLevel", undefined, { shouldValidate: true, shouldDirty: true });
    clearErrors(["studentNumber", "yearLevel"]);
  }, [clearErrors, role, setValue]);

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
    onError: (error) => {
      const message = applyServerValidationErrors(error, { setError, setFocus });
      setFormErrorMessage(message ?? "Unable to create user account.");
      toast.error(message ?? getErrorMessage(error, "Unable to create user account."));
    }
  });

  const updateMutation = useMutation({
    mutationFn: (values: UserFormValues) => userApi.update(selectedUser!.id, values),
    onSuccess: async () => {
      toast.success("User account updated.");
      await invalidate();
    },
    onError: (error) => {
      const message = applyServerValidationErrors(error, { setError, setFocus });
      setFormErrorMessage(message ?? "Unable to update user account.");
      toast.error(message ?? getErrorMessage(error, "Unable to update user account."));
    }
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: "ACTIVE" | "DEACTIVATED" }) =>
      userApi.updateStatus(id, status),
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update user status."))
  });

  const onSubmit = async (values: UserFormValues) => {
    setFormErrorMessage(null);
    const payload = sanitizeUserPayload(values, Boolean(selectedUser));

    if (selectedUser) {
      await updateMutation.mutateAsync(payload as UserFormValues);
      return;
    }

    if (!payload.password) {
      const passwordMessage = "Password is required for new users.";
      setError("password", { type: "manual", message: passwordMessage });
      setFormErrorMessage(passwordMessage);
      toast.error(passwordMessage);
      return;
    }

    await createMutation.mutateAsync(payload as UserFormValues & { password: string });
  };

  const onInvalidSubmit: SubmitErrorHandler<UserFormValues> = (formErrors) => {
    const firstErrorMessage = Object.values(formErrors).find(
      (error): error is { message?: string } => Boolean(error?.message)
    )?.message;

    setFormErrorMessage(firstErrorMessage ?? invalidUserFormMessage);
    toast.error(firstErrorMessage ?? invalidUserFormMessage);
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
        ) : users.length ? (
          <>
            <div className="space-y-3 md:hidden">
              {paginatedUsers.map((user) => (
                <div key={user.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">
                        {user.firstName} {user.lastName}
                      </p>
                      <p className="mt-1 break-all text-sm text-slate-500">{user.email}</p>
                    </div>
                    <StatusBadge status={user.status} />
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{user.role.replace("_", " ")}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {user.department ?? "Not specified"}
                  </p>
                  {user.studentNumber ? (
                    <p className="mt-1 text-sm text-slate-500">{user.studentNumber}</p>
                  ) : null}
                  <div className="mt-4 flex flex-wrap gap-2">
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
                      onClick={() => setStatusTargetUser(user)}
                    >
                      {user.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
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
                  {paginatedUsers.map((user) => (
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
                          onClick={() => setStatusTargetUser(user)}
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

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, users.length)} of {users.length} users
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  Previous
                </Button>
                <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
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
          setFormErrorMessage(null);
        }}
      >
        <form
          className="grid gap-5 md:grid-cols-2"
          onSubmit={handleSubmit(onSubmit, onInvalidSubmit)}
        >
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
            <Input autoComplete="email" inputMode="email" type="email" {...register("email")} />
          </FormField>
          <FormField label="Password" error={errors.password?.message}>
            <Input
              type="password"
              autoComplete={selectedUser ? "current-password" : "new-password"}
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
            <Input autoComplete="organization" maxLength={120} {...register("department")} />
          </FormField>
          {role === "STUDENT" ? (
            <>
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
            </>
          ) : null}
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
          {formErrorMessage ? (
            <div
              className="md:col-span-2 rounded-2xl border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
              role="alert"
            >
              {formErrorMessage}
            </div>
          ) : null}
          <div className="md:col-span-2 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              fullWidth
              type="button"
              onClick={() => {
                setOpen(false);
                setSelectedUser(null);
                setFormErrorMessage(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              fullWidth
              disabled={
                isSubmitting || createMutation.isPending || updateMutation.isPending
              }
            >
              {selectedUser
                ? updateMutation.isPending
                  ? "Saving..."
                  : "Save Changes"
                : createMutation.isPending
                  ? "Creating..."
                  : "Create User"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(statusTargetUser)}
        title={statusTargetUser?.status === "ACTIVE" ? "Deactivate User" : "Activate User"}
        description={
          statusTargetUser
            ? `${
                statusTargetUser.status === "ACTIVE" ? "Deactivate" : "Activate"
              } ${statusTargetUser.firstName} ${statusTargetUser.lastName}'s account?`
            : ""
        }
        confirmLabel={statusTargetUser?.status === "ACTIVE" ? "Deactivate" : "Activate"}
        tone={statusTargetUser?.status === "ACTIVE" ? "danger" : "primary"}
        isPending={statusMutation.isPending}
        onClose={() => setStatusTargetUser(null)}
        onConfirm={() =>
          statusTargetUser
            ? statusMutation.mutate(
                {
                  id: statusTargetUser.id,
                  status: statusTargetUser.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE"
                },
                {
                  onSuccess: async () => {
                    toast.success("User status updated.");
                    setStatusTargetUser(null);
                    await queryClient.invalidateQueries({ queryKey: ["users"] });
                  }
                }
              )
            : undefined
        }
      />
    </div>
  );
};
