import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { laboratoryApi, scheduleApi, staffApi } from "../../api/services";
import { useAuth } from "../../store/AuthContext";
import type { Schedule } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { EmptyState } from "../../components/ui/EmptyState";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatTimeRange } from "../../utils/format";

const adminScheduleSchema = z.object({
  laboratoryId: z.coerce.number().min(1),
  date: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  status: z.enum(["AVAILABLE", "BLOCKED", "CLOSED"])
});

const staffScheduleSchema = adminScheduleSchema.omit({
  laboratoryId: true
});

type AdminScheduleFormValues = z.infer<typeof adminScheduleSchema>;
type StaffScheduleFormValues = z.infer<typeof staffScheduleSchema>;

const AdminScheduleWorkspace = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);
  const [selectedLaboratoryId, setSelectedLaboratoryId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const { data: laboratories } = useQuery({
    queryKey: ["laboratories"],
    queryFn: laboratoryApi.list
  });

  const { data, isLoading } = useQuery({
    queryKey: ["schedules", selectedLaboratoryId, selectedDate],
    queryFn: () =>
      scheduleApi.list({
        laboratoryId: selectedLaboratoryId || undefined,
        date: selectedDate || undefined
      })
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AdminScheduleFormValues>({
    resolver: zodResolver(adminScheduleSchema),
    defaultValues: {
      status: "AVAILABLE"
    }
  });

  useEffect(() => {
    if (selectedSchedule) {
      reset({
        laboratoryId: selectedSchedule.laboratoryId,
        date: selectedSchedule.date.slice(0, 10),
        startTime: selectedSchedule.startTime,
        endTime: selectedSchedule.endTime,
        status: selectedSchedule.status
      });
      return;
    }

    reset({
      laboratoryId: laboratories?.[0]?.id ?? 1,
      date: "",
      startTime: "",
      endTime: "",
      status: "AVAILABLE"
    });
  }, [laboratories, reset, selectedSchedule]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["schedules"] });
    setOpen(false);
    setSelectedSchedule(null);
  };

  const createMutation = useMutation({
    mutationFn: (values: AdminScheduleFormValues) => scheduleApi.create(values),
    onSuccess: async () => {
      toast.success("Schedule created.");
      await invalidate();
    },
    onError: () => toast.error("Unable to create schedule. Check for overlap conflicts.")
  });

  const updateMutation = useMutation({
    mutationFn: (values: AdminScheduleFormValues) =>
      scheduleApi.update(selectedSchedule!.id, values),
    onSuccess: async () => {
      toast.success("Schedule updated.");
      await invalidate();
    },
    onError: () => toast.error("Unable to update schedule.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.remove(id),
    onError: () =>
      toast.error("Unable to delete this schedule. It may already have reservation history.")
  });

  const onSubmit = async (values: AdminScheduleFormValues) => {
    if (selectedSchedule) {
      await updateMutation.mutateAsync(values);
      return;
    }

    await createMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule Management"
        description="Publish available room slots for reservation and keep schedule conflicts under control."
        actions={<Button onClick={() => setOpen(true)}>Add Schedule</Button>}
      />

      <Card className="mb-6">
        <div className="grid gap-4 md:grid-cols-3">
          <FormField label="Filter by Laboratory">
            <Select
              value={selectedLaboratoryId}
              onChange={(event) => setSelectedLaboratoryId(event.target.value)}
            >
              <option value="">All Laboratories</option>
              {laboratories?.map((laboratory) => (
                <option key={laboratory.id} value={laboratory.id}>
                  {laboratory.roomCode} - {laboratory.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Filter by Date">
            <Input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
            />
          </FormField>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div>Loading schedules...</div>
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Time</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-slate-900">{schedule.laboratory?.name}</p>
                      <p className="mt-1 text-slate-500">{schedule.laboratory?.roomCode}</p>
                    </td>
                    <td className="py-4 pr-4">{formatDate(schedule.date)}</td>
                    <td className="py-4 pr-4">
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={schedule.status} />
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedSchedule(schedule);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => setScheduleToDelete(schedule)}>
                          Delete
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
            title="No schedules available"
            description="Create laboratory schedules so students can begin submitting reservation requests."
          />
        )}
      </Card>

      <Modal
        open={open}
        title={selectedSchedule ? "Edit Schedule" : "Add Schedule"}
        onClose={() => {
          setOpen(false);
          setSelectedSchedule(null);
        }}
      >
        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Laboratory" error={errors.laboratoryId?.message}>
            <Select {...register("laboratoryId", { valueAsNumber: true })}>
              {laboratories?.map((laboratory) => (
                <option key={laboratory.id} value={laboratory.id}>
                  {laboratory.roomCode} - {laboratory.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Date" error={errors.date?.message}>
            <Input type="date" {...register("date")} />
          </FormField>
          <FormField label="Start Time" error={errors.startTime?.message}>
            <Input type="time" {...register("startTime")} />
          </FormField>
          <FormField label="End Time" error={errors.endTime?.message}>
            <Input type="time" {...register("endTime")} />
          </FormField>
          <FormField label="Status" error={errors.status?.message}>
            <Select {...register("status")}>
              {["AVAILABLE", "BLOCKED", "CLOSED"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setSelectedSchedule(null);
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
              {selectedSchedule ? "Save Changes" : "Create Schedule"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(scheduleToDelete)}
        title="Delete Schedule"
        description={
          scheduleToDelete
            ? `Delete the ${formatDate(scheduleToDelete.date)} ${formatTimeRange(
                scheduleToDelete.startTime,
                scheduleToDelete.endTime
              )} schedule for ${scheduleToDelete.laboratory?.roomCode ?? "this laboratory"}?`
            : ""
        }
        confirmLabel="Delete Schedule"
        isPending={deleteMutation.isPending}
        onClose={() => setScheduleToDelete(null)}
        onConfirm={() =>
          scheduleToDelete
            ? deleteMutation.mutate(scheduleToDelete.id, {
                onSuccess: async () => {
                  toast.success("Schedule deleted.");
                  setScheduleToDelete(null);
                  await queryClient.invalidateQueries({ queryKey: ["schedules"] });
                }
              })
            : undefined
        }
      />
    </div>
  );
};

const StaffScheduleWorkspace = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);

  const { data: myLab } = useQuery({
    queryKey: ["staff-my-lab"],
    queryFn: staffApi.getMyLab
  });

  const { data: mySchedules, isLoading } = useQuery({
    queryKey: ["staff-my-lab-schedules"],
    queryFn: staffApi.getMyLabSchedules
  });

  const { data: publicSchedules } = useQuery({
    queryKey: ["staff-public-schedules"],
    queryFn: () => staffApi.listPublicSchedules()
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<StaffScheduleFormValues>({
    resolver: zodResolver(staffScheduleSchema),
    defaultValues: {
      status: "AVAILABLE"
    }
  });

  useEffect(() => {
    if (selectedSchedule) {
      reset({
        date: selectedSchedule.date.slice(0, 10),
        startTime: selectedSchedule.startTime,
        endTime: selectedSchedule.endTime,
        status: selectedSchedule.status
      });
      return;
    }

    reset({
      date: "",
      startTime: "",
      endTime: "",
      status: "AVAILABLE"
    });
  }, [reset, selectedSchedule]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["staff-my-lab-schedules"] });
    await queryClient.invalidateQueries({ queryKey: ["staff-public-schedules"] });
    setOpen(false);
    setSelectedSchedule(null);
  };

  const createMutation = useMutation({
    mutationFn: (values: StaffScheduleFormValues) =>
      scheduleApi.create({
        ...values,
        laboratoryId: myLab!.id
      }),
    onSuccess: async () => {
      toast.success("Schedule created.");
      await invalidate();
    },
    onError: () => toast.error("Unable to create the schedule.")
  });

  const updateMutation = useMutation({
    mutationFn: (values: StaffScheduleFormValues) =>
      staffApi.updateMyLabSchedule(selectedSchedule!.id, values),
    onSuccess: async () => {
      toast.success("Schedule updated.");
      await invalidate();
    },
    onError: () => toast.error("Unable to update the schedule.")
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => scheduleApi.remove(id),
    onError: () =>
      toast.error("Unable to delete this schedule. It may already have reservation history.")
  });

  const readOnlySchedules = useMemo(
    () => (publicSchedules ?? []).filter((schedule) => schedule.laboratoryId !== myLab?.id),
    [myLab?.id, publicSchedules]
  );

  const onSubmit = async (values: StaffScheduleFormValues) => {
    if (selectedSchedule) {
      await updateMutation.mutateAsync(values);
      return;
    }

    await createMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule Management"
        description="Manage schedules for the assigned laboratory and review public schedule availability from other labs."
        actions={<Button onClick={() => setOpen(true)}>Add Schedule</Button>}
      />

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Assigned Laboratory</h2>
          <p className="text-sm text-slate-500">
            {myLab ? `${myLab.roomCode} - ${myLab.name}` : "No assigned laboratory"}
          </p>
        </div>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : mySchedules?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Time</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mySchedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="py-4 pr-4">{formatDate(schedule.date)}</td>
                    <td className="py-4 pr-4">
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={schedule.status} />
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedSchedule(schedule);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => setScheduleToDelete(schedule)}>
                          Delete
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
            title="No schedules found"
            description="Create the first schedule block for the assigned laboratory."
          />
        )}
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Other Laboratories</h2>
          <p className="text-sm text-slate-500">Read-only published schedules from other labs.</p>
        </div>
        {readOnlySchedules.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Time</th>
                  <th className="py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {readOnlySchedules.map((schedule) => (
                  <tr key={schedule.id}>
                    <td className="py-4 pr-4">
                      {schedule.laboratory?.roomCode}
                      <p className="mt-1 text-slate-500">{schedule.laboratory?.name}</p>
                    </td>
                    <td className="py-4 pr-4">{formatDate(schedule.date)}</td>
                    <td className="py-4 pr-4">
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </td>
                    <td className="py-4">
                      <StatusBadge status={schedule.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No public schedules found"
            description="Published schedules from other laboratories will appear here."
          />
        )}
      </Card>

      <Modal
        open={open}
        title={selectedSchedule ? "Edit Schedule" : "Add Schedule"}
        onClose={() => {
          setOpen(false);
          setSelectedSchedule(null);
        }}
      >
        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Assigned Laboratory">
            <Input value={myLab ? `${myLab.roomCode} - ${myLab.name}` : ""} disabled />
          </FormField>
          <FormField label="Date" error={errors.date?.message}>
            <Input type="date" {...register("date")} />
          </FormField>
          <FormField label="Start Time" error={errors.startTime?.message}>
            <Input type="time" {...register("startTime")} />
          </FormField>
          <FormField label="End Time" error={errors.endTime?.message}>
            <Input type="time" {...register("endTime")} />
          </FormField>
          <FormField label="Status" error={errors.status?.message}>
            <Select {...register("status")}>
              {["AVAILABLE", "BLOCKED", "CLOSED"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormField>
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setSelectedSchedule(null);
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                isSubmitting || createMutation.isPending || updateMutation.isPending || !myLab
              }
            >
              {selectedSchedule ? "Save Changes" : "Create Schedule"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(scheduleToDelete)}
        title="Delete Schedule"
        description={
          scheduleToDelete
            ? `Delete the ${formatDate(scheduleToDelete.date)} ${formatTimeRange(
                scheduleToDelete.startTime,
                scheduleToDelete.endTime
              )} schedule?`
            : ""
        }
        confirmLabel="Delete Schedule"
        isPending={deleteMutation.isPending}
        onClose={() => setScheduleToDelete(null)}
        onConfirm={() =>
          scheduleToDelete
            ? deleteMutation.mutate(scheduleToDelete.id, {
                onSuccess: async () => {
                  toast.success("Schedule deleted.");
                  setScheduleToDelete(null);
                  await queryClient.invalidateQueries({ queryKey: ["staff-my-lab-schedules"] });
                }
              })
            : undefined
        }
      />
    </div>
  );
};

export const ScheduleManagementPage = () => {
  const { user } = useAuth();

  if (user?.role === "LABORATORY_STAFF") {
    return <StaffScheduleWorkspace />;
  }

  return <AdminScheduleWorkspace />;
};
