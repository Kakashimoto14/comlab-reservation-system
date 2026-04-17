import { useQuery } from "@tanstack/react-query";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from "chart.js";
import { Activity, Building2, CheckCircle2, ClipboardList, Clock3 } from "lucide-react";
import { Line } from "react-chartjs-2";

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
    return <div>Loading dashboard...</div>;
  }

  return (
    <div>
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

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <h2 className="text-xl font-semibold text-slate-900">Reservation Trend</h2>
          <p className="mt-2 text-sm text-slate-500">
            Reservation activity over the most recent seven-day window.
          </p>
          <div className="mt-6 h-80">
            {data?.trends?.length ? (
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

        <Card>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-brand-100 p-3">
              <Activity className="h-5 w-5 text-brand-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Recent Activity</h2>
              <p className="text-sm text-slate-500">Latest actions across the system.</p>
            </div>
          </div>

          {data?.recentActivity?.length ? (
            <div className="mt-6 space-y-4">
              {data.recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-slate-200 p-4">
                  <p className="font-medium text-slate-800">{activity.description}</p>
                  <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-400">
                    {formatDateTime(activity.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No activity logs"
                description="Recent administrative and reservation activity will appear here."
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};
