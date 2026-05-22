import { useQuery } from "@tanstack/react-query";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  Filler
} from "chart.js";
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3
} from "lucide-react";
import { Line } from "react-chartjs-2";
import { Link } from "react-router-dom";

import { dashboardApi } from "../../api/services";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatCard } from "../../components/ui/StatCard";
import { formatDateTime } from "../../utils/format";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

export const StaffDashboardPage = () => {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get
  });

  const recentActivity = data?.recentActivity ?? [];
  const hasTrendData = Boolean(data?.trends?.length);

  const chartData = {
    labels: data?.trends?.map((item) => item.date) ?? [],
    datasets: [
      {
        label: "Reservations",
        data: data?.trends?.map((item) => item.count) ?? [],
        borderColor: "#355692",
        backgroundColor: "rgba(53, 86, 146, 0.12)",
        tension: 0.35,
        fill: true
      }
    ]
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Operations Dashboard"
          description="Monitor overall reservation performance, pending requests, and recent system activity."
        />

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {["Total Reservations", "Pending Requests", "Approved Requests", "Laboratories"].map(
            (title) => (
              <Card key={title} className="min-h-36">
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-3">
                    <div className="h-3 w-28 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-8 w-16 animate-pulse rounded-lg bg-slate-200" />
                  </div>
                  <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-100" />
                </div>
                <div className="mt-5 h-3 w-full animate-pulse rounded-full bg-slate-100" />
                <span className="sr-only">Loading {title}</span>
              </Card>
            )
          )}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
          <Card className="min-h-[28rem]">
            <div className="h-6 w-44 animate-pulse rounded-full bg-slate-200" />
            <div className="mt-3 h-4 w-72 max-w-full animate-pulse rounded-full bg-slate-100" />
            <div className="mt-8 h-72 animate-pulse rounded-2xl bg-slate-50" />
          </Card>

          <Card className="flex min-h-[28rem] flex-col">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-100" />
              <div className="space-y-3">
                <div className="h-5 w-36 animate-pulse rounded-full bg-slate-200" />
                <div className="h-3 w-48 animate-pulse rounded-full bg-slate-100" />
              </div>
            </div>
            <div className="mt-6 space-y-3">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="flex gap-3 rounded-2xl border border-slate-100 p-3">
                  <div className="mt-1 h-2.5 w-2.5 animate-pulse rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-3">
                    <div className="h-4 w-full animate-pulse rounded-full bg-slate-100" />
                    <div className="h-3 w-32 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Dashboard"
        description="Monitor overall reservation performance, pending requests, and recent system activity."
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Reservations"
          value={data?.totals.reservations ?? 0}
          helper="All requests recorded in the system."
          icon={ClipboardList}
        />
        <StatCard
          title="Pending Requests"
          value={data?.totals.pending ?? 0}
          helper="Reservations waiting for review."
          icon={Clock3}
        />
        <StatCard
          title="Approved Requests"
          value={data?.totals.approved ?? 0}
          helper="Current approved laboratory sessions."
          icon={CheckCircle2}
        />
        <StatCard
          title="Laboratories"
          value={data?.totals.laboratories ?? 0}
          helper="Published and manageable rooms."
          icon={Building2}
        />
      </div>

      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <Card className="flex min-h-[28rem] flex-col">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Reservation Trend</h2>
              <p className="mt-1 text-sm text-slate-500">
                Reservation activity over the most recent seven-day window.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">
              7 days
            </span>
          </div>
          <div className="mt-6 h-80 flex-1">
            {hasTrendData ? (
              <Line
                data={chartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  }
                }}
              />
            ) : (
              <EmptyState
                title="No trend data yet"
                description="Reservation charts will appear once users begin creating requests."
              />
            )}
          </div>
        </Card>

        <Card className="flex min-h-[28rem] flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-2xl bg-brand-100 p-3">
                <Activity className="h-5 w-5 text-brand-700" />
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
                <p className="text-sm text-slate-500">Latest actions across the system.</p>
              </div>
            </div>
            <Link
              to="/management/reservations"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
            >
              Reservation queue
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {recentActivity.length ? (
            <div className="mt-6 max-h-80 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
              <div className="space-y-1">
                {recentActivity.map((activity, index) => (
                  <div key={activity.id} className="relative flex gap-3 py-3">
                    {index < recentActivity.length - 1 ? (
                      <span className="absolute left-[5px] top-7 h-[calc(100%-1rem)] w-px bg-slate-200" />
                    ) : null}
                    <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-white bg-brand-600 shadow-[0_0_0_2px_rgba(53,86,146,0.14)]" />
                    <div className="min-w-0 flex-1 rounded-2xl px-2 pb-2">
                      <p className="text-sm font-medium leading-6 text-slate-800">
                        {activity.description}
                      </p>
                      <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {formatDateTime(activity.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {recentActivity.length > 6 ? (
                <div className="sticky bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
              ) : null}
            </div>
          ) : (
            <div className="mt-6 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
              <div>
                <Activity className="mx-auto h-8 w-8 text-brand-500" />
                <h3 className="mt-3 text-sm font-semibold text-slate-800">No activity logs</h3>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Administrative and reservation activity will appear here.
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
