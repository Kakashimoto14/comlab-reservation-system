import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LaptopMinimal, MapPin, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { isSameDay } from "date-fns";

import { laboratoryApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { WeeklyScheduleGrid } from "../../components/ui/WeeklyScheduleGrid";
import { formatDate, formatTimeRange } from "../../utils/format";

export const LaboratoryDetailsPage = () => {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["laboratory", id],
    queryFn: () => laboratoryApi.getById(Number(id)),
    enabled: Boolean(id)
  });
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const schedulesForSelectedDate = useMemo(() => {
    if (!data?.schedules?.length) {
      return [];
    }

    if (!selectedDate) {
      return data.schedules.slice(0, 3);
    }

    return data.schedules.filter((schedule) => isSameDay(new Date(schedule.date), selectedDate));
  }, [data?.schedules, selectedDate]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Laboratory Details"
          description="Loading room information and published schedules..."
        />
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <Card className="h-[28rem] animate-pulse bg-slate-100" />
          <div className="space-y-6">
            <Card className="h-48 animate-pulse bg-slate-100" />
            <Card className="h-64 animate-pulse bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <EmptyState
        title="Laboratory not found"
        description="The selected room may have been removed or is no longer available."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.name}
        description="Review room information, published schedule blocks, and open booking windows before reserving this laboratory."
        actions={
          <Link to={`/student/laboratories/${data.id}/reserve`}>
            <Button>Reserve This Laboratory</Button>
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden p-0">
          <div className="h-80 bg-slate-200">
            {data.imageUrl ? (
              <img className="h-full w-full object-cover" src={data.imageUrl} alt={data.name} />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-100 text-sm font-medium text-slate-400">
                No laboratory image available
              </div>
            )}
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Room Overview</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">{data.roomCode}</h2>
              </div>
              <StatusBadge status={data.status} />
            </div>
            <p className="mt-6 text-sm leading-7 text-slate-500">{data.description}</p>
          </div>
        </Card>

        <div className="space-y-6">
          <Card>
            <h3 className="text-lg font-semibold text-slate-900">Laboratory Information</h3>
            <div className="mt-5 space-y-4 text-sm text-slate-600">
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-brand-600" />
                {data.building}
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4 text-brand-600" />
                Capacity: {data.capacity}
              </div>
              <div className="flex items-center gap-3">
                <LaptopMinimal className="h-4 w-4 text-brand-600" />
                Computers: {data.computerCount}
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Selected Day Summary</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedDate
                    ? `Showing availability for ${formatDate(selectedDate.toISOString())}.`
                    : "Choose a day from the timetable below to focus on a specific date."}
                </p>
              </div>
              {selectedDate ? (
                <Button variant="secondary" onClick={() => setSelectedDate(null)}>
                  Clear Day
                </Button>
              ) : null}
            </div>
            {schedulesForSelectedDate.length ? (
              <div className="mt-5 space-y-3">
                {schedulesForSelectedDate.map((schedule) => (
                  <div key={schedule.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 text-sm text-slate-600">
                        <CalendarDays className="h-4 w-4 text-brand-600" />
                        {formatDate(schedule.date)}
                      </div>
                      <StatusBadge status={schedule.status} />
                    </div>
                    <p className="mt-3 text-sm font-medium text-slate-800">
                      {formatTimeRange(schedule.startTime, schedule.endTime)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  title="No schedules for this selection"
                  description="Pick another day in the weekly timetable or wait for laboratory staff to publish availability."
                />
              </div>
            )}
          </Card>
        </div>
      </div>

      <WeeklyScheduleGrid
        schedules={data.schedules ?? []}
        reservations={data.reservations ?? []}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        emptyMessage="The laboratory staff has not posted any available times for this room yet."
      />
    </div>
  );
};
