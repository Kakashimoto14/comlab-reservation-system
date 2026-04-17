import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";

import { laboratoryApi } from "../../api/services";
import type { Laboratory } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
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
    return (
      (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage
    );
  }

  return fallbackMessage;
};

const sanitizeLaboratoryPayload = (values: LaboratoryFormValues) => ({
  ...values,
  name: values.name.trim(),
  roomCode: values.roomCode.trim(),
  building: values.building.trim(),
  description: values.description.trim(),
  imageUrl: values.imageUrl?.trim() || undefined
});

export const LaboratoryManagementPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedLaboratory, setSelectedLaboratory] = useState<Laboratory | null>(null);
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
    onSuccess: async () => {
      toast.success("Laboratory deleted.");
      await queryClient.invalidateQueries({ queryKey: ["laboratories"] });
    },
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
                    <td className="py-4 pr-4">{laboratory.building}</td>
                    <td className="py-4 pr-4">
                      {laboratory.capacity} seats / {laboratory.computerCount} computers
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
                        <Button
                          variant="danger"
                          onClick={() => deleteMutation.mutate(laboratory.id)}
                        >
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
                    <img
                      src={imageValue}
                      alt="Laboratory preview"
                      className="h-40 w-full object-cover"
                    />
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
    </div>
  );
};
