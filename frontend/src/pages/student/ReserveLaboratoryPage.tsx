import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import type { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { isSameDay } from "date-fns";
import { z } from "zod";

import { laboratoryApi, reservationApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { FormField } from "../../components/ui/FormField";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { WeeklyScheduleGrid } from "../../components/ui/WeeklyScheduleGrid";
import { formatClockTime, formatDate, formatTimeRange } from "../../utils/format";
import {
  buildFreeWindows,
  buildTimeOptions,
  groupReservationsByScheduleId,
  mergeTimeWindows
} from "../../utils/schedule";

const reservationSchema = z.object({
  purpose: z.string().min(10, "Please provide a clear reservation purpose."),
  selectedScheduleId: z.string().min(1, "Choose an available schedule."),
  startTime: z.string().min(1, "Choose a start time."),
  endTime: z.string().min(1, "Choose an end time.")
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

export const ReserveLaboratoryPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["laboratory", id],
    queryFn: () => laboratoryApi.getById(Number(id)),
    enabled: Boolean(id)
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting }
  } = useForm<ReservationFormValues>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      selectedScheduleId: "",
      startTime: "",
      endTime: ""
    }
  });

  const allAvailableSchedules = useMemo(
    () =>
      [...(data?.schedules ?? [])]
        .filter((schedule) => schedule.status === "AVAILABLE")
        .sort((a, b) => `${a.date}-${a.startTime}`.localeCompare(`${b.date}-${b.startTime}`)),
    [data?.schedules]
  );

  const availableSchedules = useMemo(() => {
    if (!selectedDate) {
      return allAvailableSchedules;
    }

    return allAvailableSchedules.filter((schedule) =>
      isSameDay(new Date(schedule.date), selectedDate)
    );
  }, [allAvailableSchedules, selectedDate]);

  const reservationsByScheduleId = useMemo(
    () => groupReservationsByScheduleId(data?.reservations ?? []),
    [data?.reservations]
  );

  const selectedScheduleId = watch("selectedScheduleId");
  const startTime = watch("startTime");

  const selectedSchedule = useMemo(
    () => allAvailableSchedules.find((schedule) => schedule.id === Number(selectedScheduleId)),
    [allAvailableSchedules, selectedScheduleId]
  );

  const occupiedWindows = useMemo(() => {
    if (!selectedSchedule) {
      return [];
    }

    return mergeTimeWindows(
      (reservationsByScheduleId.get(selectedSchedule.id) ?? []).map((reservation) => ({
        startTime: reservation.startTime,
        endTime: reservation.endTime
      }))
    );
  }, [reservationsByScheduleId, selectedSchedule]);

  const freeWindows = useMemo(
    () =>
      selectedSchedule
        ? buildFreeWindows(
            selectedSchedule,
            reservationsByScheduleId.get(selectedSchedule.id) ?? []
          )
        : [],
    [reservationsByScheduleId, selectedSchedule]
  );

  const startTimeOptions = useMemo(
    () =>
      freeWindows.flatMap((window) =>
        buildTimeOptions(window.startTime, window.endTime).slice(0, -1)
      ),
    [freeWindows]
  );

  const endTimeOptions = useMemo(() => {
    if (!startTime) {
      return [];
    }

    const containingWindow = freeWindows.find(
      (window) => startTime >= window.startTime && startTime < window.endTime
    );

    if (!containingWindow) {
      return [];
    }

    return buildTimeOptions(containingWindow.startTime, containingWindow.endTime).filter(
      (time) => time > startTime
    );
  }, [freeWindows, startTime]);

  useEffect(() => {
    if (
      selectedSchedule &&
      selectedDate &&
      !isSameDay(new Date(selectedSchedule.date), selectedDate)
    ) {
      setValue("selectedScheduleId", "");
    }
  }, [selectedDate, selectedSchedule, setValue]);

  useEffect(() => {
    setValue("startTime", "");
    setValue("endTime", "");
  }, [selectedScheduleId, setValue]);

  const createReservationMutation = useMutation({
    mutationFn: (values: ReservationFormValues) =>
      reservationApi.create({
        scheduleId: Number(values.selectedScheduleId),
        laboratoryId: Number(id),
        purpose: values.purpose,
        startTime: values.startTime,
        endTime: values.endTime
      }),
    onSuccess: () => {
      toast.success("Reservation request submitted.");
      navigate("/student/reservations");
    },
    onError: (error: AxiosError<{ message?: string }>) => {
      toast.error(
        error.response?.data?.message ??
          "Unable to submit reservation. Review the selected schedule and time range."
      );
    }
  });

  const onSubmit = async (values: ReservationFormValues) => {
    if (!selectedSchedule) {
      toast.error(
        "Choose one published schedule first, then select your reservation time inside the open slot."
      );
      return;
    }

    await createReservationMutation.mutateAsync(values);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Reserve Laboratory"
          description="Loading schedule availability and reservation windows..."
        />
        <div className="grid gap-6 xl:grid-cols-[0.7fr_1fr_0.9fr]">
          <Card className="h-72 animate-pulse bg-slate-100" />
          <Card className="h-96 animate-pulse bg-slate-100" />
          <Card className="h-96 animate-pulse bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Laboratory unavailable"
        description="We could not load this room. Please return to the laboratory list and choose another laboratory."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reserve Laboratory"
        description="Choose a date, review the weekly timetable, and book only inside the open windows for the selected schedule block."
      />

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1fr_0.9fr]">
        <Card className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Selected Laboratory</h3>
            <p className="mt-4 text-xl font-semibold text-brand-700">{data.name}</p>
            <p className="mt-2 text-sm text-slate-500">
              {data.roomCode} | {data.building}
            </p>
          </div>

          {data.imageUrl ? (
            <img
              src={data.imageUrl}
              alt={data.name}
              className="h-44 w-full rounded-2xl object-cover"
            />
          ) : null}

          <p className="text-sm leading-7 text-slate-500">{data.description}</p>
          <StatusBadge status={data.status} />
        </Card>

        <Card>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <FormField label="Reservation Purpose" error={errors.purpose?.message}>
              <Textarea
                placeholder="Example: Database laboratory activity for BSIT 2A students."
                {...register("purpose")}
              />
            </FormField>

            <div className="grid gap-5 md:grid-cols-3">
              <FormField label="Schedule Block" error={errors.selectedScheduleId?.message}>
                <Select {...register("selectedScheduleId")}>
                  <option value="">Select a schedule</option>
                  {availableSchedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {formatDate(schedule.date)} |{" "}
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Start Time" error={errors.startTime?.message}>
                <Select {...register("startTime")} disabled={!selectedSchedule}>
                  <option value="">Select start time</option>
                  {startTimeOptions.map((time) => (
                    <option key={time} value={time}>
                      {formatClockTime(time)}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="End Time" error={errors.endTime?.message}>
                <Select {...register("endTime")} disabled={!startTime}>
                  <option value="">Select end time</option>
                  {endTimeOptions.map((time) => (
                    <option key={time} value={time}>
                      {formatClockTime(time)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {selectedSchedule ? (
              <div className="space-y-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">
                <p>
                  You selected {formatDate(selectedSchedule.date)} with availability from{" "}
                  {formatTimeRange(selectedSchedule.startTime, selectedSchedule.endTime)}.
                </p>
                {occupiedWindows.length ? (
                  <div className="rounded-2xl bg-white/80 p-3 text-slate-700">
                    <p className="font-medium text-slate-900">Already occupied</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {occupiedWindows.map((window) => (
                        <span
                          key={`${window.startTime}-${window.endTime}`}
                          className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700"
                        >
                          {formatTimeRange(window.startTime, window.endTime)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                {freeWindows.length ? (
                  <div className="rounded-2xl bg-white/80 p-3 text-slate-700">
                    <p className="font-medium text-slate-900">Open booking windows</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {freeWindows.map((window) => (
                        <span
                          key={`${window.startTime}-${window.endTime}`}
                          className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700"
                        >
                          {formatTimeRange(window.startTime, window.endTime)}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-amber-50 p-3 text-amber-800">
                    This schedule block is fully occupied. Choose another day or schedule.
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                Pick a date from the weekly timetable or select a schedule block to begin.
              </div>
            )}

            <Button
              type="submit"
              disabled={
                isSubmitting ||
                createReservationMutation.isPending ||
                !selectedSchedule ||
                freeWindows.length === 0
              }
            >
              {isSubmitting || createReservationMutation.isPending
                ? "Submitting..."
                : "Submit Reservation Request"}
            </Button>
          </form>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Date Availability</h3>
              <p className="mt-2 text-sm text-slate-500">
                {selectedDate
                  ? `Showing schedule blocks for ${formatDate(selectedDate.toISOString())}.`
                  : "Choose a day from the timetable below to filter available schedule blocks."}
              </p>
            </div>
            {selectedDate ? (
              <Button variant="secondary" onClick={() => setSelectedDate(null)}>
                Clear
              </Button>
            ) : null}
          </div>

          {availableSchedules.length ? (
            <div className="space-y-3">
              {availableSchedules.map((schedule) => {
                const scheduleFreeWindows = buildFreeWindows(
                  schedule,
                  reservationsByScheduleId.get(schedule.id) ?? []
                );

                return (
                  <button
                    key={schedule.id}
                    type="button"
                    className={`block w-full rounded-2xl border p-4 text-left transition ${
                      selectedSchedule?.id === schedule.id
                        ? "border-brand-300 bg-brand-50"
                        : "border-slate-200 hover:border-brand-300 hover:bg-brand-50"
                    }`}
                    onClick={() => setValue("selectedScheduleId", String(schedule.id))}
                    disabled={scheduleFreeWindows.length === 0}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{formatDate(schedule.date)}</p>
                      <StatusBadge status={schedule.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </p>
                    {scheduleFreeWindows.length ? (
                      <p className="mt-2 text-xs text-emerald-700">
                        Open:{" "}
                        {scheduleFreeWindows
                          .map((window) => formatTimeRange(window.startTime, window.endTime))
                          .join(" | ")}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-rose-700">
                        Fully occupied by existing reservations
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No schedules match this date"
              description="Pick another day from the timetable or wait for laboratory staff to publish additional schedule blocks."
            />
          )}
        </Card>
      </div>

      <WeeklyScheduleGrid
        schedules={data.schedules ?? []}
        reservations={data.reservations ?? []}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        emptyMessage="Ask the administrator or laboratory staff to publish an available schedule for this room first."
      />
    </div>
  );
};
