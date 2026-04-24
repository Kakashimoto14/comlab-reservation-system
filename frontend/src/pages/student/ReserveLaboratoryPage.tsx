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
  mergeTimeWindows,
  toMinutes
} from "../../utils/schedule";

const reservationSchema = z.object({
  purpose: z.string().min(10, "Please provide a clear reservation purpose."),
  reservationType: z.enum(["LAB", "PC"]),
  selectedScheduleId: z.string().min(1, "Choose an available schedule."),
  startTime: z.string().min(1, "Choose a start time."),
  endTime: z.string().min(1, "Choose an end time."),
  pcId: z.string().optional()
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

const overlaps = (
  leftStart: string,
  leftEnd: string,
  rightStart: string,
  rightEnd: string
) => toMinutes(leftStart) < toMinutes(rightEnd) && toMinutes(leftEnd) > toMinutes(rightStart);

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
      reservationType: "LAB",
      selectedScheduleId: "",
      startTime: "",
      endTime: "",
      pcId: ""
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

  const reservationType = watch("reservationType");
  const selectedScheduleId = watch("selectedScheduleId");
  const startTime = watch("startTime");
  const endTime = watch("endTime");

  const selectedSchedule = useMemo(
    () => allAvailableSchedules.find((schedule) => schedule.id === Number(selectedScheduleId)),
    [allAvailableSchedules, selectedScheduleId]
  );

  const scheduleReservations = useMemo(
    () => (selectedSchedule ? reservationsByScheduleId.get(selectedSchedule.id) ?? [] : []),
    [reservationsByScheduleId, selectedSchedule]
  );

  const wholeLabReservations = useMemo(
    () => scheduleReservations.filter((reservation) => reservation.reservationType === "LAB"),
    [scheduleReservations]
  );

  const occupiedWindows = useMemo(() => {
    if (!selectedSchedule) {
      return [];
    }

    return mergeTimeWindows(
      (reservationType === "LAB" ? scheduleReservations : wholeLabReservations).map(
        (reservation) => ({
          startTime: reservation.startTime,
          endTime: reservation.endTime
        })
      )
    );
  }, [reservationType, scheduleReservations, selectedSchedule, wholeLabReservations]);

  const freeWindows = useMemo(
    () =>
      selectedSchedule
        ? buildFreeWindows(
            selectedSchedule,
            reservationType === "LAB" ? scheduleReservations : wholeLabReservations
          )
        : [],
    [reservationType, scheduleReservations, selectedSchedule, wholeLabReservations]
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

  const availablePcs = useMemo(() => {
    if (!selectedSchedule || reservationType !== "PC") {
      return [];
    }

    return (data?.pcs ?? []).filter((pc) => {
      if (pc.status !== "AVAILABLE") {
        return false;
      }

      if (!startTime || !endTime) {
        return true;
      }

      const hasBlockingReservation = scheduleReservations.some((reservation) => {
        if (!overlaps(reservation.startTime, reservation.endTime, startTime, endTime)) {
          return false;
        }

        if (reservation.reservationType === "LAB") {
          return true;
        }

        return reservation.pcId === pc.id;
      });

      return !hasBlockingReservation;
    });
  }, [data?.pcs, endTime, reservationType, scheduleReservations, selectedSchedule, startTime]);

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
    setValue("pcId", "");
  }, [reservationType, selectedScheduleId, setValue]);

  const createReservationMutation = useMutation({
    mutationFn: (values: ReservationFormValues) =>
      reservationApi.create({
        scheduleId: Number(values.selectedScheduleId),
        laboratoryId: Number(id),
        reservationType: values.reservationType,
        pcId: values.reservationType === "PC" && values.pcId ? Number(values.pcId) : null,
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

    if (values.reservationType === "PC" && !values.pcId) {
      toast.error("Select an available PC for a PC reservation.");
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
        description="Choose a date, select a schedule, and reserve either the whole laboratory or a specific PC."
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
            <img src={data.imageUrl} alt={data.name} className="h-44 w-full rounded-2xl object-cover" />
          ) : null}

          <p className="text-sm leading-7 text-slate-500">{data.description}</p>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={data.status} />
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {data.pcs.length} PCs
            </span>
          </div>
        </Card>

        <Card>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-5 md:grid-cols-2">
              <FormField label="Reservation Type" error={errors.reservationType?.message}>
                <Select {...register("reservationType")}>
                  <option value="LAB">Whole Laboratory</option>
                  <option value="PC">Specific PC</option>
                </Select>
              </FormField>
              <FormField label="Schedule Block" error={errors.selectedScheduleId?.message}>
                <Select {...register("selectedScheduleId")}>
                  <option value="">Select a schedule</option>
                  {availableSchedules.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {formatDate(schedule.date)} | {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            <FormField label="Reservation Purpose" error={errors.purpose?.message}>
              <Textarea
                placeholder="Example: Database laboratory activity for BSIT 2A students."
                {...register("purpose")}
              />
            </FormField>

            <div className="grid gap-5 md:grid-cols-3">
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
              <FormField
                label="Specific PC"
                error={reservationType === "PC" ? errors.pcId?.message : undefined}
              >
                <Select {...register("pcId")} disabled={reservationType !== "PC" || !selectedSchedule}>
                  <option value="">Select a PC</option>
                  {availablePcs.map((pc) => (
                    <option key={pc.id} value={pc.id}>
                      {pc.pcNumber}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>

            {selectedSchedule ? (
              <div className="space-y-3 rounded-2xl bg-brand-50 p-4 text-sm text-brand-800">
                <p>
                  You selected {formatDate(selectedSchedule.date)} with published availability from{" "}
                  {formatTimeRange(selectedSchedule.startTime, selectedSchedule.endTime)}.
                </p>
                {occupiedWindows.length ? (
                  <div className="rounded-2xl bg-white/80 p-3 text-slate-700">
                    <p className="font-medium text-slate-900">
                      {reservationType === "LAB" ? "Occupied windows" : "Whole-lab blocking windows"}
                    </p>
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
                    This schedule block has no remaining availability for the selected reservation type.
                  </div>
                )}
                {reservationType === "PC" && startTime && endTime ? (
                  <div className="rounded-2xl bg-white/80 p-3 text-slate-700">
                    <p className="font-medium text-slate-900">Available PCs</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {availablePcs.length ? (
                        availablePcs.map((pc) => (
                          <span
                            key={pc.id}
                            className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700"
                          >
                            {pc.pcNumber}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-rose-700">
                          No PCs are available for the selected time.
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
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
                freeWindows.length === 0 ||
                (reservationType === "PC" && (!startTime || !endTime || availablePcs.length === 0))
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
                const scheduleEntries = reservationsByScheduleId.get(schedule.id) ?? [];
                const labFreeWindows = buildFreeWindows(schedule, scheduleEntries);
                const pcFreeWindows = buildFreeWindows(
                  schedule,
                  scheduleEntries.filter((reservation) => reservation.reservationType === "LAB")
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
                    disabled={
                      reservationType === "LAB"
                        ? labFreeWindows.length === 0
                        : pcFreeWindows.length === 0
                    }
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-slate-900">{formatDate(schedule.date)}</p>
                      <StatusBadge status={schedule.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </p>
                    <p className="mt-2 text-xs text-slate-600">
                      Whole lab:{" "}
                      {labFreeWindows.length
                        ? labFreeWindows
                            .map((window) => formatTimeRange(window.startTime, window.endTime))
                            .join(" | ")
                        : "Fully booked"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      PC booking:{" "}
                      {pcFreeWindows.length
                        ? pcFreeWindows
                            .map((window) => formatTimeRange(window.startTime, window.endTime))
                            .join(" | ")
                        : "Blocked by whole-lab reservations"}
                    </p>
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
