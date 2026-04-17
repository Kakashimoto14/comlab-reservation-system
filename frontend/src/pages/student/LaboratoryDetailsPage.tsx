import { useQuery } from "@tanstack/react-query";
import { CalendarDays, LaptopMinimal, MapPin, Users } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { laboratoryApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatTimeRange } from "../../utils/format";

export const LaboratoryDetailsPage = () => {
  const { id } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["laboratory", id],
    queryFn: () => laboratoryApi.getById(Number(id)),
    enabled: Boolean(id)
  });

  if (isLoading) {
    return <div>Loading laboratory details...</div>;
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
    <div>
      <PageHeader
        title={data.name}
        description="Review the room information and published schedules before reserving this laboratory."
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
            ) : null}
          </div>
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Room Overview</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-900">
                  {data.roomCode}
                </h2>
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
            <h3 className="text-lg font-semibold text-slate-900">Published Schedules</h3>
            {data.schedules?.length ? (
              <div className="mt-5 space-y-3">
                {data.schedules.map((schedule) => (
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
                  title="No schedules yet"
                  description="The laboratory staff has not posted any available times for this room yet."
                />
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};
