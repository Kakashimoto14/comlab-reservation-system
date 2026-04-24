import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import toast from "react-hot-toast";
import { AxiosError } from "axios";

import { calendarApi, laboratoryApi } from "../../api/services";
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
import type { CalendarDisplayEvent } from "../../types/api";
import { formatDate, formatTimeRange } from "../../utils/format";

const calendarEventSchema = z.object({
  title: z.string().min(3),
  type: z.enum(["MAINTENANCE", "HOLIDAY"]),
  laboratoryId: z.string().optional(),
  date: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  description: z.string().optional()
});

type CalendarEventFormValues = z.infer<typeof calendarEventSchema>;

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AxiosError) {
    return (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage;
  }

  return fallbackMessage;
};

export const ManagementCalendarPage = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedLaboratoryId, setSelectedLaboratoryId] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<CalendarDisplayEvent | null>(null);
  const [eventToDelete, setEventToDelete] = useState<CalendarDisplayEvent | null>(null);

  const { data: laboratories } = useQuery({
    queryKey: ["laboratories"],
    queryFn: laboratoryApi.list
  });

  const { data, isLoading } = useQuery({
    queryKey: ["calendar", selectedLaboratoryId, selectedDate],
    queryFn: () =>
      calendarApi.list({
        laboratoryId: selectedLaboratoryId || undefined,
        date: selectedDate || undefined
      })
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<CalendarEventFormValues>({
    resolver: zodResolver(calendarEventSchema),
    defaultValues: {
      type: "MAINTENANCE"
    }
  });

  useEffect(() => {
    if (!selectedEvent || selectedEvent.source !== "CALENDAR_EVENT") {
      reset({
        title: "",
        type: "MAINTENANCE",
        laboratoryId: "",
        date: "",
        startTime: "",
        endTime: "",
        description: ""
      });
      return;
    }

    reset({
      title: selectedEvent.title,
      type: selectedEvent.type as "MAINTENANCE" | "HOLIDAY",
      laboratoryId: selectedEvent.laboratory?.id ? String(selectedEvent.laboratory.id) : "",
      date: selectedEvent.date.slice(0, 10),
      startTime: selectedEvent.startTime ?? "",
      endTime: selectedEvent.endTime ?? "",
      description: selectedEvent.description ?? ""
    });
  }, [reset, selectedEvent]);

  const refreshCalendar = async () => {
    await queryClient.invalidateQueries({ queryKey: ["calendar"] });
    setSelectedEvent(null);
    setOpen(false);
  };

  const createMutation = useMutation({
    mutationFn: (values: CalendarEventFormValues) =>
      calendarApi.create({
        ...values,
        laboratoryId: values.laboratoryId ? Number(values.laboratoryId) : null,
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        description: values.description || null
      }),
    onSuccess: async () => {
      toast.success("Calendar event created.");
      await refreshCalendar();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to create the calendar event."))
  });

  const updateMutation = useMutation({
    mutationFn: (values: CalendarEventFormValues) =>
      calendarApi.update(selectedEvent!.id, {
        ...values,
        laboratoryId: values.laboratoryId ? Number(values.laboratoryId) : null,
        startTime: values.startTime || null,
        endTime: values.endTime || null,
        description: values.description || null
      }),
    onSuccess: async () => {
      toast.success("Calendar event updated.");
      await refreshCalendar();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to update the calendar event."))
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => calendarApi.remove(id),
    onSuccess: async () => {
      toast.success("Calendar event deleted.");
      await queryClient.invalidateQueries({ queryKey: ["calendar"] });
      setEventToDelete(null);
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to delete the calendar event."))
  });

  const events = useMemo(
    () => [...(data?.customEvents ?? []), ...(data?.derivedEvents ?? [])].sort((left, right) =>
      `${left.date}-${left.startTime ?? ""}`.localeCompare(`${right.date}-${right.startTime ?? ""}`)
    ),
    [data]
  );

  const onSubmit = async (values: CalendarEventFormValues) => {
    if (selectedEvent?.source === "CALENDAR_EVENT") {
      await updateMutation.mutateAsync(values);
      return;
    }

    await createMutation.mutateAsync(values);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Management Calendar"
        description="Review schedules, reservations, and maintenance or holiday blocks from a single master calendar view."
        actions={<Button onClick={() => setOpen(true)}>Add Calendar Event</Button>}
      />

      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Filter by Laboratory">
            <Select
              value={selectedLaboratoryId}
              onChange={(event) => setSelectedLaboratoryId(event.target.value)}
            >
              <option value="">All laboratories</option>
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
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : events.length ? (
          <div className="space-y-4">
            {events.map((event) => (
              <div
                key={`${event.source}-${event.id}`}
                className="rounded-2xl border border-slate-200 p-4"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="font-semibold text-slate-900">{event.title}</p>
                      <StatusBadge status={event.type as Parameters<typeof StatusBadge>[0]["status"]} />
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        {event.source.replace("_", " ")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500">
                      {formatDate(event.date)}
                      {event.startTime && event.endTime
                        ? ` | ${formatTimeRange(event.startTime, event.endTime)}`
                        : ""}
                    </p>
                    <p className="text-sm text-slate-500">
                      {event.laboratory
                        ? `${event.laboratory.roomCode} - ${event.laboratory.name}`
                        : "Global event"}
                    </p>
                    {event.description ? (
                      <p className="text-sm text-slate-600">{event.description}</p>
                    ) : null}
                  </div>

                  {event.source === "CALENDAR_EVENT" ? (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setSelectedEvent(event);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button variant="danger" onClick={() => setEventToDelete(event)}>
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No calendar items found"
            description="Adjust the filters or create a maintenance or holiday block to populate the management calendar."
          />
        )}
      </Card>

      <Modal
        open={open}
        title={selectedEvent?.source === "CALENDAR_EVENT" ? "Edit Calendar Event" : "Add Calendar Event"}
        onClose={() => {
          setOpen(false);
          setSelectedEvent(null);
        }}
      >
        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit(onSubmit)}>
          <div className="md:col-span-2">
            <FormField label="Title" error={errors.title?.message}>
              <Input {...register("title")} />
            </FormField>
          </div>
          <FormField label="Type" error={errors.type?.message}>
            <Select {...register("type")}>
              <option value="MAINTENANCE">MAINTENANCE</option>
              <option value="HOLIDAY">HOLIDAY</option>
            </Select>
          </FormField>
          <FormField label="Laboratory">
            <Select {...register("laboratoryId")}>
              <option value="">All laboratories</option>
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
          <FormField label="Start Time">
            <Input type="time" {...register("startTime")} />
          </FormField>
          <FormField label="End Time">
            <Input type="time" {...register("endTime")} />
          </FormField>
          <div className="md:col-span-2">
            <FormField label="Description">
              <Textarea {...register("description")} />
            </FormField>
          </div>
          <div className="md:col-span-2 flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setOpen(false);
                setSelectedEvent(null);
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
              {selectedEvent?.source === "CALENDAR_EVENT" ? "Save Changes" : "Create Event"}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(eventToDelete)}
        title="Delete Calendar Event"
        description={
          eventToDelete
            ? `Delete ${eventToDelete.title} from the management calendar?`
            : ""
        }
        confirmLabel="Delete Event"
        isPending={deleteMutation.isPending}
        onClose={() => setEventToDelete(null)}
        onConfirm={() => (eventToDelete ? deleteMutation.mutate(eventToDelete.id) : undefined)}
      />
    </div>
  );
};
