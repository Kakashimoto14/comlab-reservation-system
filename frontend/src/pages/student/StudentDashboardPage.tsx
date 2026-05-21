import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CalendarCheck2,
  CalendarPlus,
  CheckCircle2,
  Clock3,
  HelpCircle
} from "lucide-react";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatTimeRange } from "../../utils/format";

const reservationSteps = [
  "Choose a lab",
  "Select schedule",
  "Submit request",
  "Wait for approval"
];

const statusExplanations = [
  { status: "Pending", description: "Waiting for approval" },
  { status: "Approved", description: "Accepted by laboratory staff" },
  { status: "Cancelled", description: "Reservation cancelled" },
  { status: "Completed", description: "Session finished" }
];

const assistantPrompts = [
  "How do I reserve a laboratory?",
  "Where can I see my reservation?",
  "What schedules are available?",
  "What does pending mean?"
];

export const StudentDashboardPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get
  });

  if (isLoading) {
    return <div>Loading dashboard...</div>;
  }

  const reservationStats = [
    {
      title: "Pending Reservations",
      value: data?.totals.pending ?? 0,
      helper: "Waiting for approval.",
      icon: Clock3
    },
    {
      title: "Approved Reservations",
      value: data?.totals.approved ?? 0,
      helper: "Ready to use.",
      icon: CalendarCheck2
    },
    {
      title: "Completed Reservations",
      value: data?.totals.completed ?? 0,
      helper: "Finished sessions.",
      icon: CheckCircle2
    },
    {
      title: "Available Laboratories",
      value: data?.totals.availableLaboratories ?? 0,
      helper: "Open for reservations.",
      icon: Building2
    }
  ];

  return (
    <div>
      <PageHeader
        title="Student Dashboard"
        description="Reserve a computer laboratory, check your request status, and follow your latest reservation updates."
      />

      <Card className="mb-6 overflow-hidden border-brand-200 bg-gradient-to-br from-white via-white to-brand-50">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-brand-700/10 p-3 text-brand-700">
                <CalendarPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">
                  Student reservations
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">
                  Reserve a computer laboratory with ease
                </h2>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
              Choose an available laboratory schedule, submit your request, and track your
              reservation status.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row lg:pt-2">
            <Link to="/student/laboratories" className="sm:w-40">
              <Button fullWidth>
                Reserve Now
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/student/reservations" className="sm:w-40">
              <Button variant="outline" fullWidth>
                My Reservations
              </Button>
            </Link>
          </div>
        </div>

        <ol className="mt-6 grid gap-3 border-t border-brand-100 pt-5 sm:grid-cols-2 xl:grid-cols-4">
          {reservationSteps.map((step, index) => (
            <li key={step} className="flex items-center gap-3 text-sm text-slate-600">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-brand-700 ring-1 ring-brand-200">
                {index + 1}
              </span>
              <span className="font-medium">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reservationStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.title} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">{stat.title}</p>
                  <h3 className="mt-2 text-2xl font-bold text-slate-900">{stat.value}</h3>
                  <p className="mt-1 text-sm text-slate-500">{stat.helper}</p>
                </div>
                <div className="rounded-2xl bg-brand-700/10 p-2.5 text-brand-700">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_20rem]">
        <Card>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Recent Reservations</h2>
              <p className="mt-1 text-sm text-slate-500">
                Track your latest requests and status updates.
              </p>
            </div>
            <Link to="/student/reservations">
              <Button variant="outline" className="w-full sm:w-auto">
                View all
              </Button>
            </Link>
          </div>

          {data?.recentReservations?.length ? (
            <div className="divide-y divide-slate-100">
              {data.recentReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="py-4 first:pt-0 last:pb-0 sm:flex sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">
                      {reservation.laboratory?.name} ({reservation.laboratory?.roomCode})
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(reservation.reservationDate)} |{" "}
                      {formatTimeRange(reservation.startTime, reservation.endTime)}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">{reservation.purpose}</p>
                  </div>
                  <div className="mt-3 shrink-0 sm:ml-4 sm:mt-0">
                    <StatusBadge status={reservation.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No reservations yet"
              description="Your latest reservation requests will appear here."
            />
          )}
        </Card>

        <Card className="!p-5">
          <h2 className="text-lg font-semibold text-slate-900">Status Guide</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {statusExplanations.map((item) => (
              <div
                key={item.status}
                className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <p className="text-sm font-semibold text-slate-900">{item.status}</p>
                <p className="text-right text-sm text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="mt-6 !p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-brand-700/10 p-3 text-brand-700">
              <HelpCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">ComPort Assistant</h2>
              <p className="mt-1 text-sm text-slate-500">Quick questions for reservation help.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {assistantPrompts.map((prompt) => (
              <span
                key={prompt}
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600"
              >
                {prompt}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
};
