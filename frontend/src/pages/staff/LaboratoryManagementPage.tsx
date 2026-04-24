import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { laboratoryApi, staffApi } from "../../api/services";
import { useAuth } from "../../store/AuthContext";
import type { Laboratory, PC } from "../../types/api";
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
import { Textarea } from "../../components/ui/Textarea";

const imagePattern = /^(https?:\/\/.+|data:image\/(png|jpe?g|webp|gif);base64,.+)$/i;

const laboratorySchema = z.object({
  name: z.string().min(3),
  roomCode: z.string().min(3),
  building: z.string().min(3),
  location: z.string().min(3).optional().or(z.literal("")),
  capacity: z.coerce.number().min(1),
  computerCount: z.coerce.number().min(1),
  description: z.string().min(10),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "MAINTENANCE"]),
  imageUrl: z
    .string()
    .optional()
    .refine((value) => !value || imagePattern.test(value), {
      message: "Provide a valid image URL or upload a PNG, JPG, WEBP, or GIF image."
    })
});

type LaboratoryFormValues = z.infer<typeof laboratorySchema>;

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AxiosError) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage;
  }

  return fallbackMessage;
};

const sanitizeLaboratoryPayload = (values: LaboratoryFormValues) => ({
  ...values,
  name: values.name.trim(),
  roomCode: values.roomCode.trim(),
  building: values.building.trim(),
  location: values.location?.trim() || undefined,
  description: values.description.trim(),
  imageUrl: values.imageUrl?.trim() || undefined
});

const StaffLaboratoryWorkspace = () => {
  const queryClient = useQueryClient();

  const { data: myLab, isLoading: isLoadingLab } = useQuery({
    queryKey: ["staff-my-lab"],
    queryFn: staffApi.getMyLab
  });

  const { data: pcs, isLoading: isLoadingPcs } = useQuery({
    queryKey: ["staff-my-lab-pcs"],
    queryFn: staffApi.getMyLabPcs
  });

  const { data: availability } = useQuery({
    queryKey: ["staff-lab-availability"],
    queryFn: () => staffApi.listAvailability()
  });

  const pcStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: PC["status"] }) =>
      staffApi.updateMyLabPcStatus(id, status),
    onSuccess: async () => {
      toast.success("PC status updated.");
      await queryClient.invalidateQueries({ queryKey: ["staff-my-lab-pcs"] });
      await queryClient.invalidateQueries({ queryKey: ["staff-lab-availability"] });
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update the PC status."))
  });

  const otherLaboratories = useMemo(
    () => (availability ?? []).filter((laboratory) => laboratory.id !== myLab?.id),
    [availability, myLab?.id]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Laboratory Management"
        description="View the assigned laboratory, maintain PC status, and check other laboratories for public availability."
      />

      <Card>
        {isLoadingLab ? (
          <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
        ) : myLab ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold text-slate-900">{myLab.name}</h2>
                <StatusBadge status={myLab.status} />
              </div>
              <p className="text-sm text-slate-500">
                {myLab.roomCode} | {myLab.building}
              </p>
              <p className="text-sm leading-7 text-slate-600">{myLab.description}</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Capacity
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{myLab.capacity}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Registered PCs
                </p>
                <p className="mt-2 text-lg font-semibold text-slate-900">
                  {myLab._count?.pcs ?? myLab.computerCount}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Location
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {myLab.location ?? `${myLab.building} - ${myLab.roomCode}`}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No assigned laboratory"
            description="An administrator needs to assign a laboratory to this staff account before management features become available."
          />
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">PC Status</h2>
            <p className="text-sm text-slate-500">Update workstation readiness for the assigned lab.</p>
          </div>
        </div>

        {isLoadingPcs ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-16 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : pcs?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">PC</th>
                  <th className="py-3 pr-4">Current Status</th>
                  <th className="py-3">Update Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pcs.map((pc) => (
                  <tr key={pc.id}>
                    <td className="py-4 pr-4 font-medium text-slate-900">{pc.pcNumber}</td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={pc.status} />
                    </td>
                    <td className="py-4">
                      <Select
                        value={pc.status}
                        onChange={(event) =>
                          pcStatusMutation.mutate({
                            id: pc.id,
                            status: event.target.value as PC["status"]
                          })
                        }
                        disabled={pcStatusMutation.isPending}
                      >
                        {["AVAILABLE", "OCCUPIED", "MAINTENANCE"].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No PCs found"
            description="The assigned laboratory does not have generated PC records yet."
          />
        )}
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Other Laboratory Availability</h2>
          <p className="text-sm text-slate-500">
            Read-only availability data for referring students when your lab is full.
          </p>
        </div>
        {otherLaboratories.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Availability</th>
                  <th className="py-3 pr-4">Schedules</th>
                  <th className="py-3">PC Load</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {otherLaboratories.map((laboratory) => (
                  <tr key={laboratory.id}>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-slate-900">{laboratory.name}</p>
                      <p className="mt-1 text-slate-500">
                        {laboratory.roomCode} | {laboratory.building}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={laboratory.availabilityStatus} />
                    </td>
                    <td className="py-4 pr-4">{laboratory.availableScheduleCount} open blocks</td>
                    <td className="py-4">
                      {laboratory.occupiedPcCount}/{laboratory.totalPcCount} occupied
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No other laboratories found"
            description="Availability from other laboratories will appear here once more laboratory records exist."
          />
        )}
      </Card>
    </div>
  );
};

const AdminLaboratoryWorkspace = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedLaboratory, setSelectedLaboratory] = useState<Laboratory | null>(null);
  const [laboratoryToDelete, setLaboratoryToDelete] = useState<Laboratory | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["laboratories"],
    queryFn: laboratoryApi.list
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting }
  } = useForm<LaboratoryFormValues>({
    resolver: zodResolver(laboratorySchema),
    defaultValues: {
      status: "AVAILABLE"
    }
  });

  const imageValue = watch("imageUrl");

  useEffect(() => {
    if (selectedLaboratory) {
      reset({
        name: selectedLaboratory.name,
        roomCode: selectedLaboratory.roomCode,
        building: selectedLaboratory.building,
        location: selectedLaboratory.location ?? "",
        capacity: selectedLaboratory.capacity,
        computerCount: selectedLaboratory.computerCount,
        description: selectedLaboratory.description,
        status: selectedLaboratory.status,
        imageUrl: selectedLaboratory.imageUrl ?? ""
      });
      return;
    }

    reset({
      name: "",
      roomCode: "",
      building: "",
      location: "",
      capacity: 30,
      computerCount: 25,
      description: "",
      status: "AVAILABLE",
      imageUrl: ""
    });
  }, [reset, selectedLaboratory]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["laboratories"] });
    setOpen(false);
    setSelectedLaboratory(null);
  };

  const createMutation = useMutation({
    mutationFn: (values: LaboratoryFormValues) => laboratoryApi.create(values),
    onSuccess: async () => {
      toast.success("Laboratory created.");
      await invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to create laboratory."))
  });

  const updateMutation = useMutation({
    mutationFn: (values: LaboratoryFormValues) =>
      laboratoryApi.update(selectedLaboratory!.id, values),
    onSuccess: async () => {
      toast.success("Laboratory updated.");
      await invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update laboratory."))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => laboratoryApi.remove(id),
    onError: (error) =>
      toast.error(
        getErrorMessage(
          error,
          "Unable to delete this laboratory. It may already have reservation history."
        )
      )
  });

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Upload a PNG, JPG, WEBP, or GIF image.");
      event.target.value = "";
      return;
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Unable to read the selected image."));
      reader.readAsDataURL(file);
    }).catch(() => "");

    if (!dataUrl) {
      toast.error("Unable to process the selected image.");
      event.target.value = "";
      return;
    }

    setValue("imageUrl", dataUrl, { shouldDirty: true, shouldValidate: true });
    toast.success("Image selected.");
    event.target.value = "";
  };

  const onSubmit = async (values: LaboratoryFormValues) => {
    const payload = sanitizeLaboratoryPayload(values);

    if (selectedLaboratory) {
      await updateMutation.mutateAsync(payload);
      return;
    }

    await createMutation.mutateAsync(payload);
  };

  return (
    <div>
      <PageHeader
        title="Laboratory Management"
        description="Create and maintain academic laboratory spaces, room information, and reservation availability."
        actions={<Button onClick={() => setOpen(true)}>Add Laboratory</Button>}
      />

      <Card>
        {isLoading ? (
          <div>Loading laboratories...</div>
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Location</th>
                  <th className="py-3 pr-4">Capacity</th>
                  <th className="py-3 pr-4">Custodian</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((laboratory) => (
                  <tr key={laboratory.id}>
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        {laboratory.imageUrl ? (
                          <img
                            src={laboratory.imageUrl}
                            alt={laboratory.name}
                            className="h-12 w-12 rounded-2xl border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400">
                            No
                            <br />
                            image
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-slate-900">{laboratory.name}</p>
                          <p className="mt-1 text-slate-500">{laboratory.roomCode}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4">
                      <p>{laboratory.building}</p>
                      <p className="mt-1 text-slate-500">{laboratory.location ?? "Not specified"}</p>
                    </td>
                    <td className="py-4 pr-4">
                      {laboratory.capacity} seats / {laboratory.computerCount} computers
                    </td>
                    <td className="py-4 pr-4">
                      {laboratory.custodian
                        ? `${laboratory.custodian.firstName} ${laboratory.custodian.lastName}`
                        : "Unassigned"}
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={laboratory.status} />
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedLaboratory(laboratory);
                            setOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button variant="danger" onClick={() => setLaboratoryToDelete(laboratory)}>
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
            title="No laboratories available"
            description="Add your first laboratory to start building the reservation catalog."
          />
        )}
      </Card>

      <Modal
        open={open}
        title={selectedLaboratory ? "Edit Laboratory" : "Add Laboratory"}
        onClose={() => {
          setOpen(false);
          setSelectedLaboratory(null);
        }}
      >
        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <FormField label="Laboratory Name" error={errors.name?.message}>
            <Input {...register("name")} />
          </FormField>
          <FormField label="Room Code" error={errors.roomCode?.message}>
            <Input {...register("roomCode")} />
          </FormField>
          <FormField label="Building" error={errors.building?.message}>
            <Input {...register("building")} />
          </FormField>
          <FormField label="Location" error={errors.location?.message}>
            <Input {...register("location")} placeholder="Optional custom location label" />
          </FormField>
          <FormField label="Status" error={errors.status?.message}>
            <Select {...register("status")}>
              {["AVAILABLE", "UNAVAILABLE", "MAINTENANCE"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Capacity" error={errors.capacity?.message}>
            <Input type="number" {...register("capacity", { valueAsNumber: true })} />
          </FormField>
          <FormField label="Number of Computers" error={errors.computerCount?.message}>
            <Input type="number" {...register("computerCount", { valueAsNumber: true })} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Image URL (Optional)" error={errors.imageUrl?.message}>
              <div className="space-y-3">
                <Input
                  placeholder="Paste a direct image link or use the upload field below."
                  {...register("imageUrl")}
                />
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={handleImageUpload}
                />
                <p className="text-xs text-slate-500">
                  Upload PNG, JPG, WEBP, or GIF images, or paste a direct image URL.
                </p>
                {imageValue ? (
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <img src={imageValue} alt="Laboratory preview" className="h-40 w-full object-cover" />
                  </div>
                ) : null}
              </div>
            </FormField>
          </div>
          <div className="md:col-span-2">
            <FormField label="Description" error={errors.description?.message}>
              <Textarea {...register("description")} />
            </FormField>
          </div>
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setSelectedLaboratory(null);
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
              {selectedLaboratory ? "Save Changes" : "Create Laboratory"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(laboratoryToDelete)}
        title="Delete Laboratory"
        description={
          laboratoryToDelete
            ? `Delete ${laboratoryToDelete.name} (${laboratoryToDelete.roomCode}) from the laboratory catalog? Existing schedules or reservation history may block this action.`
            : ""
        }
        confirmLabel="Delete Laboratory"
        isPending={deleteMutation.isPending}
        onClose={() => setLaboratoryToDelete(null)}
        onConfirm={() =>
          laboratoryToDelete
            ? deleteMutation.mutate(laboratoryToDelete.id, {
                onSuccess: async () => {
                  toast.success("Laboratory deleted.");
                  setLaboratoryToDelete(null);
                  await queryClient.invalidateQueries({ queryKey: ["laboratories"] });
                }
              })
            : undefined
        }
      />
    </div>
  );
};

export const LaboratoryManagementPage = () => {
  const { user } = useAuth();

  if (user?.role === "LABORATORY_STAFF") {
    return <StaffLaboratoryWorkspace />;
  }

  return <AdminLaboratoryWorkspace />;
};
