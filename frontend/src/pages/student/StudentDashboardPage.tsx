import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CalendarCheck2, CheckCircle2, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/services";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatTimeRange } from "../../utils/format";
import { Card } from "../../components/ui/Card";
import { Button } from "../../components/ui/Button";

export const StudentDashboardPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Student Dashboard"
          description="Loading your reservation summary and latest activity..."
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index} className="h-36 animate-pulse bg-slate-100" />
          ))}
        </div>
        <Card className="h-72 animate-pulse bg-slate-100" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Student Dashboard"
        description="Track your reservation requests, browse available laboratories, and prepare your next booking."
        actions={
          <Link to="/student/laboratories">
            <Button>Browse Laboratories</Button>
          </Link>
        }
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending Reservations"
          value={data?.totals.pending ?? 0}
          helper="Awaiting review from admin or laboratory staff."
          icon={Clock3}
        />
        <StatCard
          title="Approved Reservations"
          value={data?.totals.approved ?? 0}
          helper="Ready for your approved laboratory sessions."
          icon={CalendarCheck2}
        />
        <StatCard
          title="Completed Reservations"
          value={data?.totals.completed ?? 0}
          helper="Completed requests recorded in your history."
          icon={CheckCircle2}
        />
        <StatCard
          title="Available Laboratories"
          value={data?.totals.availableLaboratories ?? 0}
          helper="Rooms currently open for future requests."
          icon={Building2}
        />
      </div>

      <Card className="mt-8 overflow-hidden border-brand-100 bg-[radial-gradient(circle_at_top_right,_rgba(73,111,182,0.14),_transparent_28%),linear-gradient(135deg,_#f4f7fb,_#ffffff_55%,_#f8fafc)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3">
              <img
                src="/comport-logo.png"
                alt="ComPort logo"
                className="h-12 w-12 rounded-2xl border border-white/80 bg-white object-cover p-1 shadow-soft"
              />
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
                  ComPort Assistant
                </p>
                <p className="text-sm text-slate-500">Live help from current reservation data</p>
              </div>
            </div>
            <h2 className="mt-4 text-2xl font-semibold text-slate-900">
              Ask before you book, reschedule, or double-check a lab
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Get quick answers from the current ComPort reservation records without leaving your
              student workspace.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
              <span className="rounded-full bg-white px-3 py-1.5 shadow-soft">
                Available schedules this week
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 shadow-soft">
                My upcoming reservations
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 shadow-soft">
                Reservation rules
              </span>
              <span className="rounded-full bg-white px-3 py-1.5 shadow-soft">
                Available labs today
              </span>
            </div>
          </div>

          <Link to="/assistant" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto">
              Open ComPort Assistant
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </Card>

      <Card className="mt-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Recent Reservations</h2>
            <p className="text-sm text-slate-500">Your latest booking activity and request statuses.</p>
          </div>
          <Link to="/student/reservations" className="text-sm font-semibold text-brand-700">
            View all
          </Link>
        </div>

        {data?.recentReservations?.length ? (
          <div className="space-y-4">
            {data.recentReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-2xl border border-slate-200 p-4 sm:flex sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {reservation.laboratory?.name} ({reservation.laboratory?.roomCode})
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatDate(reservation.reservationDate)} |{" "}
                    {formatTimeRange(reservation.startTime, reservation.endTime)}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">{reservation.purpose}</p>
                </div>
                <div className="mt-4 sm:mt-0">
                  <StatusBadge status={reservation.status} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="No reservations yet"
            description="Once you submit a booking request, it will appear here for quick tracking."
          />
        )}
      </Card>
    </div>
  );
};
