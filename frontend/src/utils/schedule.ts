import { addDays, endOfWeek, format, isSameDay, startOfWeek } from "date-fns";

import type { ReservationSlot, Schedule } from "../types/api";

export type TimeWindow = {
  startTime: string;
  endTime: string;
};

export const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export const toTimeString = (minutes: number) => {
  const hours = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (minutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
};

export const buildTimeOptions = (startTime: string, endTime: string, interval = 30) => {
  const options: string[] = [];

  for (let time = toMinutes(startTime); time <= toMinutes(endTime); time += interval) {
    options.push(toTimeString(time));
  }

  return options;
};

export const mergeTimeWindows = (windows: TimeWindow[]) => {
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

export const intersectWindowWithSchedule = (
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

export const buildFreeWindows = (
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

export const groupReservationsByScheduleId = (reservations: ReservationSlot[]) => {
  const groupedReservations = new Map<number, ReservationSlot[]>();

  for (const reservation of reservations) {
    if (!reservation.scheduleId) {
      continue;
    }

    groupedReservations.set(reservation.scheduleId, [
      ...(groupedReservations.get(reservation.scheduleId) ?? []),
      reservation
    ]);
  }

  return groupedReservations;
};

export const getWeekDays = (anchorDate: Date) => {
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 });
  const days: Date[] = [];

  for (
    let currentDate = weekStart;
    currentDate <= weekEnd;
    currentDate = addDays(currentDate, 1)
  ) {
    days.push(currentDate);
  }

  return days;
};

export const filterSchedulesByDate = (schedules: Schedule[], date: Date) =>
  schedules.filter((schedule) => isSameDay(new Date(schedule.date), date));

export const formatWeekLabel = (anchorDate: Date) => {
  const [startDate, endDate] = [
    startOfWeek(anchorDate, { weekStartsOn: 1 }),
    endOfWeek(anchorDate, { weekStartsOn: 1 })
  ];

  return `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`;
};
