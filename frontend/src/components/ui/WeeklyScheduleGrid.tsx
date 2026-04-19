import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { addWeeks, format, isSameDay } from "date-fns";

import type { ReservationSlot, Schedule } from "../../types/api";
import {
  buildFreeWindows,
  filterSchedulesByDate,
  formatWeekLabel,
  getWeekDays,
  groupReservationsByScheduleId,
  intersectWindowWithSchedule,
  mergeTimeWindows
} from "../../utils/schedule";
import { formatTimeRange } from "../../utils/format";
import { Button } from "./Button";
import { StatusBadge } from "./StatusBadge";

type WeeklyScheduleGridProps = {
  schedules: Schedule[];
  reservations?: ReservationSlot[];
  selectedDate?: Date | null;
  onSelectDate?: (date: Date) => void;
  emptyMessage?: string;
};

export const WeeklyScheduleGrid = ({
  schedules,
  reservations = [],
  selectedDate,
  onSelectDate,
  emptyMessage = "No schedules published for this week."
}: WeeklyScheduleGridProps) => {
  const initialAnchorDate = useMemo(() => {
    if (selectedDate) {
      return selectedDate;
    }

    if (schedules.length) {
      return new Date(schedules[0].date);
    }

    return new Date();
  }, [schedules, selectedDate]);

  const [weekAnchorDate, setWeekAnchorDate] = useState(initialAnchorDate);

  const reservationsByScheduleId = useMemo(
    () => groupReservationsByScheduleId(reservations),
    [reservations]
  );

  const weekDays = useMemo(() => getWeekDays(weekAnchorDate), [weekAnchorDate]);
  const hasWeeklySchedules = useMemo(
    () =>
      weekDays.some((day) => filterSchedulesByDate(schedules, day).length > 0),
    [schedules, weekDays]
  );

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
            Weekly Timetable
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            {formatWeekLabel(weekAnchorDate)}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            type="button"
            onClick={() => setWeekAnchorDate((currentDate) => addWeeks(currentDate, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => setWeekAnchorDate(new Date())}
          >
            This Week
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => setWeekAnchorDate((currentDate) => addWeeks(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {hasWeeklySchedules ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-7 md:grid-cols-2">
          {weekDays.map((day) => {
            const daySchedules = filterSchedulesByDate(schedules, day).sort((left, right) =>
              left.startTime.localeCompare(right.startTime)
            );

            return (
              <button
                key={day.toISOString()}
                type="button"
                className={`rounded-2xl border p-4 text-left transition ${
                  selectedDate && isSameDay(day, selectedDate)
                    ? "border-brand-300 bg-brand-50"
                    : "border-slate-200 bg-slate-50/80 hover:border-brand-200"
                }`}
                onClick={() => onSelectDate?.(day)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {format(day, "EEE")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {format(day, "MMM dd")}
                    </p>
                  </div>
                  {selectedDate && isSameDay(day, selectedDate) ? (
                    <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Selected
                    </span>
                  ) : null}
                </div>

                {daySchedules.length ? (
                  <div className="mt-4 space-y-3">
                    {daySchedules.map((schedule) => {
                      const occupiedWindows = mergeTimeWindows(
                        (reservationsByScheduleId.get(schedule.id) ?? [])
                          .map((reservation) => intersectWindowWithSchedule(schedule, reservation))
                          .filter((window): window is NonNullable<typeof window> => Boolean(window))
                      );
                      const freeWindows = buildFreeWindows(
                        schedule,
                        reservationsByScheduleId.get(schedule.id) ?? []
                      );

                      return (
                        <div
                          key={schedule.id}
                          className="rounded-2xl border border-white bg-white p-3 shadow-soft"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {formatTimeRange(schedule.startTime, schedule.endTime)}
                            </p>
                            <StatusBadge status={schedule.status} />
                          </div>

                          {occupiedWindows.length ? (
                            <div className="mt-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Occupied
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {occupiedWindows.map((window) => (
                                  <span
                                    key={`${schedule.id}-${window.startTime}-${window.endTime}`}
                                    className="rounded-full bg-rose-100 px-2 py-1 text-[11px] font-semibold text-rose-700"
                                  >
                                    {formatTimeRange(window.startTime, window.endTime)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {freeWindows.length ? (
                            <div className="mt-3">
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                                Open Slots
                              </p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {freeWindows.map((window) => (
                                  <span
                                    key={`${schedule.id}-free-${window.startTime}-${window.endTime}`}
                                    className="rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-semibold text-emerald-700"
                                  >
                                    {formatTimeRange(window.startTime, window.endTime)}
                                  </span>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs font-medium text-amber-700">
                              Fully booked for this schedule block.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                    No published schedules on this day.
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-500">
          {emptyMessage}
        </div>
      )}
    </div>
  );
};
