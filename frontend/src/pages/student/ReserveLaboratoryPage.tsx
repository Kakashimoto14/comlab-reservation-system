import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import type { AxiosError } from "axios";
import toast from "react-hot-toast";
import { useNavigate, useParams } from "react-router-dom";
import { z } from "zod";

import { laboratoryApi, reservationApi } from "../../api/services";
import type { ReservationSlot, Schedule } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { FormField } from "../../components/ui/FormField";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { formatClockTime, formatDate, formatTimeRange } from "../../utils/format";

const reservationSchema = z.object({
  purpose: z.string().min(10, "Please provide a clear reservation purpose."),
  selectedScheduleId: z.string().min(1, "Choose an available schedule."),
  startTime: z.string().min(1, "Choose a start time."),
  endTime: z.string().min(1, "Choose an end time.")
});

type ReservationFormValues = z.infer<typeof reservationSchema>;

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const toTimeString = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
};

const buildTimeOptions = (startTime: string, endTime: string, interval = 30) => {
  const options: string[] = [];

  for (let time = toMinutes(startTime); time <= toMinutes(endTime); time += interval) {
    options.push(toTimeString(time));
  }

  return options;
};

type TimeWindow = {
  startTime: string;
  endTime: string;
};

const mergeTimeWindows = (windows: TimeWindow[]) => {
  if (!windows.length) {
    return [];
  }

  const sortedWindows = [...windows].sort(
    (left, right) => toMinutes(left.startTime) - toMinutes(right.startTime)
  );
  const merged: TimeWindow[] = [sortedWindows[0]];

  for (const currentWindow of sortedWindows.slice(1)) {
    const lastWindow = merged[merged.length - 1];

    if (toMinutes(currentWindow.startTime) <= toMinutes(lastWindow.endTime)) {
      lastWindow.endTime =
        toMinutes(currentWindow.endTime) > toMinutes(lastWindow.endTime)
          ? currentWindow.endTime
          : lastWindow.endTime;
      continue;
    }

    merged.push({ ...currentWindow });
  }

  return merged;
};

const intersectWindowWithSchedule = (
  schedule: Pick<Schedule, "startTime" | "endTime">,
  reservation: Pick<ReservationSlot, "startTime" | "endTime">
) => {
  const startMinutes = Math.max(
    toMinutes(schedule.startTime),
    toMinutes(reservation.startTime)
  );
  const endMinutes = Math.min(toMinutes(schedule.endTime), toMinutes(reservation.endTime));

  if (startMinutes >= endMinutes) {
    return null;
  }

  return {
    startTime: toTimeString(startMinutes),
    endTime: toTimeString(endMinutes)
  };
};

const buildFreeWindows = (
  schedule: Pick<Schedule, "startTime" | "endTime">,
  reservations: ReservationSlot[]
) => {
  const occupiedWindows = mergeTimeWindows(
    reservations
      .map((reservation) => intersectWindowWithSchedule(schedule, reservation))
      .filter((window): window is TimeWindow => Boolean(window))
  );

  if (!occupiedWindows.length) {
    return [{ startTime: schedule.startTime, endTime: schedule.endTime }];
  }

  const freeWindows: TimeWindow[] = [];
  let cursor = toMinutes(schedule.startTime);
  const scheduleEnd = toMinutes(schedule.endTime);

  for (const occupiedWindow of occupiedWindows) {
    const occupiedStart = toMinutes(occupiedWindow.startTime);
    const occupiedEnd = toMinutes(occupiedWindow.endTime);

    if (cursor < occupiedStart) {
      freeWindows.push({
        startTime: toTimeString(cursor),
        endTime: toTimeString(occupiedStart)
      });
    }

    cursor = Math.max(cursor, occupiedEnd);
  }

  if (cursor < scheduleEnd) {
    freeWindows.push({
      startTime: toTimeString(cursor),
      endTime: toTimeString(scheduleEnd)
    });
  }

  return freeWindows.filter(
    (window) => toMinutes(window.endTime) - toMinutes(window.startTime) >= 30
  );
};

export const ReserveLaboratoryPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { data } = useQuery({
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

  const availableSchedules = useMemo(
    () =>
      [...(data?.schedules ?? [])]
        .filter((schedule) => schedule.status === "AVAILABLE")
        .sort((a, b) => {
          const left = `${a.date}-${a.startTime}`;
          const right = `${b.date}-${b.startTime}`;
          return left.localeCompare(right);
        }),
    [data?.schedules]
  );

  const reservationsByScheduleId = useMemo(() => {
    const groupedReservations = new Map<number, ReservationSlot[]>();

    for (const reservation of data?.reservations ?? []) {
      if (!reservation.scheduleId) {
        continue;
      }

      groupedReservations.set(reservation.scheduleId, [
        ...(groupedReservations.get(reservation.scheduleId) ?? []),
        reservation
      ]);
    }

    return groupedReservations;
  }, [data?.reservations]);

  const selectedScheduleId = watch("selectedScheduleId");
  const startTime = watch("startTime");

  const selectedSchedule = useMemo(
    () => availableSchedules.find((schedule) => schedule.id === Number(selectedScheduleId)),
    [availableSchedules, selectedScheduleId]
  );

  const occupiedWindows = useMemo(() => {
    if (!selectedSchedule) {
      return [];
    }

    return mergeTimeWindows(
      (reservationsByScheduleId.get(selectedSchedule.id) ?? [])
        .map((reservation) => intersectWindowWithSchedule(selectedSchedule, reservation))
        .filter((window): window is TimeWindow => Boolean(window))
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

  const endTimeOptions = useMemo(
    () => {
      if (!startTime) {
        return [];
      }

      const containingWindow = freeWindows.find(
        (window) =>
          toMinutes(startTime) >= toMinutes(window.startTime) &&
          toMinutes(startTime) < toMinutes(window.endTime)
      );

      if (!containingWindow) {
        return [];
      }

      return buildTimeOptions(containingWindow.startTime, containingWindow.endTime).filter(
        (time) => time > startTime
      );
    },
    [freeWindows, startTime]
  );

  useEffect(() => {
    setValue("startTime", "");
    setValue("endTime", "");
  }, [selectedScheduleId, setValue]);

  useEffect(() => {
    if (!startTime) {
      setValue("endTime", "");
      return;
    }

    const currentEndTime = watch("endTime");

    if (currentEndTime && currentEndTime <= startTime) {
      setValue("endTime", "");
    }
  }, [setValue, startTime, watch]);

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
          "Unable to submit reservation. Please review the selected schedule."
      );
    }
  });

  const onSubmit = async (values: ReservationFormValues) => {
    if (!selectedSchedule) {
      toast.error(
        "Choose one published schedule first, then select your reservation time inside it."
      );
      return;
    }

    await createReservationMutation.mutateAsync(values);
  };

  return (
    <div>
      <PageHeader
        title="Reserve Laboratory"
        description="Fill out the booking details carefully. The system will validate time conflicts and schedule availability."
      />

      <div className="grid gap-6 xl:grid-cols-[0.7fr_1fr_0.9fr]">
        <Card>
          <h3 className="text-lg font-semibold text-slate-900">Selected Laboratory</h3>
          <p className="mt-4 text-xl font-semibold text-brand-700">{data?.name}</p>
          <p className="mt-2 text-sm text-slate-500">
            {data?.roomCode} | {data?.building}
          </p>
          <p className="mt-4 text-sm leading-7 text-slate-500">{data?.description}</p>
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
              <FormField label="Available Schedule" error={errors.selectedScheduleId?.message}>
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
                You selected {formatDate(selectedSchedule.date)} with availability from{" "}
                {formatTimeRange(selectedSchedule.startTime, selectedSchedule.endTime)}. Any
                reservation inside an open slot below is allowed.
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
                    This schedule is fully occupied. Please choose another schedule.
                  </div>
                )}
              </div>
            ) : null}

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

        <Card>
          <h3 className="text-lg font-semibold text-slate-900">Available Schedules</h3>
          <p className="mt-2 text-sm text-slate-500">
            Your reservation must stay inside one schedule block on the same date.
          </p>

          {data?.schedules?.length ? (
            <div className="mt-5 space-y-3">
              {data.schedules.map((schedule) => (
                (() => {
                  const freeScheduleWindows = buildFreeWindows(
                    schedule,
                    reservationsByScheduleId.get(schedule.id) ?? []
                  );

                  return (
                <button
                  key={schedule.id}
                  type="button"
                  className="block w-full rounded-2xl border border-slate-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => setValue("selectedScheduleId", String(schedule.id))}
                  disabled={schedule.status !== "AVAILABLE" || freeScheduleWindows.length === 0}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-900">{formatDate(schedule.date)}</p>
                    <StatusBadge status={schedule.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {formatTimeRange(schedule.startTime, schedule.endTime)}
                  </p>
                  {freeScheduleWindows.length ? (
                    <p className="mt-2 text-xs text-emerald-700">
                      Open:{" "}
                      {freeScheduleWindows
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
                })()
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No schedules available"
                description="Ask the administrator or laboratory staff to publish an available schedule for this room first."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
