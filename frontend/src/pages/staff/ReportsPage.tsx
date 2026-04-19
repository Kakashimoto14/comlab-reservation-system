import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  CalendarRange,
  CheckCircle2,
  Download,
  Flame,
  LayoutList,
  MapPinned,
  TimerReset
} from "lucide-react";
import toast from "react-hot-toast";

import { dashboardApi, reservationApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { downloadCsv } from "../../utils/csv";
import { formatDate, formatTimeRange, fullName } from "../../utils/format";

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Tooltip, Legend);

export const ReportsPage = () => {
  const [statusFilter, setStatusFilter] = useState("");
  const [laboratoryFilter, setLaboratoryFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get
  });

  const { data: reservationsData, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationApi.list
  });

  const reservations = reservationsData ?? [];

  const laboratoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          reservations
            .map((reservation) => reservation.laboratory?.roomCode)
            .filter((value): value is string => Boolean(value))
        )
      ).sort((left, right) => left.localeCompare(right)),
    [reservations]
  );

  const filteredReservations = useMemo(() => {
    return reservations.filter((reservation) => {
      const reservationDay = reservation.reservationDate.slice(0, 10);
      const matchesStatus = statusFilter ? reservation.status === statusFilter : true;
      const matchesLaboratory = laboratoryFilter
        ? reservation.laboratory?.roomCode === laboratoryFilter
        : true;
      const matchesDateFrom = dateFrom ? reservationDay >= dateFrom : true;
      const matchesDateTo = dateTo ? reservationDay <= dateTo : true;

      return matchesStatus && matchesLaboratory && matchesDateFrom && matchesDateTo;
    });
  }, [dateFrom, dateTo, laboratoryFilter, reservations, statusFilter]);

  const summary = useMemo(() => {
    const mostUsedLabEntry = new Map<string, number>();
    const busiestDayEntry = new Map<string, number>();
    const busiestHourEntry = new Map<string, number>();

    filteredReservations.forEach((reservation) => {
      const laboratoryKey = reservation.laboratory?.roomCode ?? "Unknown";
      mostUsedLabEntry.set(laboratoryKey, (mostUsedLabEntry.get(laboratoryKey) ?? 0) + 1);

      const dayKey = formatDate(reservation.reservationDate);
      busiestDayEntry.set(dayKey, (busiestDayEntry.get(dayKey) ?? 0) + 1);

      const hourKey = reservation.startTime.slice(0, 2) + ":00";
      busiestHourEntry.set(hourKey, (busiestHourEntry.get(hourKey) ?? 0) + 1);
    });

    const mostUsedLab =
      Array.from(mostUsedLabEntry.entries()).sort((left, right) => right[1] - left[1])[0] ??
      ["-", 0];
    const busiestDay =
      Array.from(busiestDayEntry.entries()).sort((left, right) => right[1] - left[1])[0] ??
      ["-", 0];
    const busiestHour =
      Array.from(busiestHourEntry.entries()).sort((left, right) => right[1] - left[1])[0] ??
      ["-", 0];

    return {
      total: filteredReservations.length,
      pending: filteredReservations.filter((reservation) => reservation.status === "PENDING")
        .length,
      approved: filteredReservations.filter((reservation) => reservation.status === "APPROVED")
        .length,
      completed: filteredReservations.filter((reservation) => reservation.status === "COMPLETED")
        .length,
      mostUsedLab,
      busiestDay,
      busiestHour
    };
  }, [filteredReservations]);

  const reservationsByStatus = useMemo(() => {
    const counts = new Map<string, number>();

    filteredReservations.forEach((reservation) => {
      counts.set(reservation.status, (counts.get(reservation.status) ?? 0) + 1);
    });

    return Array.from(counts.entries());
  }, [filteredReservations]);

  const reservationsByLaboratory = useMemo(() => {
    const counts = new Map<string, number>();

    filteredReservations.forEach((reservation) => {
      const key = reservation.laboratory?.roomCode ?? "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries()).sort((left, right) => right[1] - left[1]).slice(0, 6);
  }, [filteredReservations]);

  const statusChartData = {
    labels: reservationsByStatus.map(([status]) => status),
    datasets: [
      {
        data: reservationsByStatus.map(([, count]) => count),
        backgroundColor: ["#fbbf24", "#34d399", "#f87171", "#cbd5e1", "#14b8a6"]
      }
    ]
  };

  const laboratoryChartData = {
    labels: reservationsByLaboratory.map(([laboratory]) => laboratory),
    datasets: [
      {
        label: "Reservations",
        data: reservationsByLaboratory.map(([, count]) => count),
        backgroundColor: "#355692"
      }
    ]
  };

  const exportReport = () => {
    downloadCsv(
      "laboratory-reservations-report.csv",
      [
        "Reservation Code",
        "Student",
        "Student Number",
        "Laboratory",
        "Date",
        "Time",
        "Status",
        "Remarks"
      ],
      filteredReservations.map((reservation) => [
        reservation.reservationCode,
        fullName(reservation.student?.firstName, reservation.student?.lastName),
        reservation.student?.studentNumber ?? "",
        `${reservation.laboratory?.roomCode ?? ""} ${reservation.laboratory?.name ?? ""}`.trim(),
        formatDate(reservation.reservationDate),
        formatTimeRange(reservation.startTime, reservation.endTime),
        reservation.status,
        reservation.remarks ?? ""
      ])
    );
    toast.success("Report exported.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Summarize reservation demand, highlight utilization patterns, and export filtered reservation data for panel-ready reporting."
        actions={
          <Button variant="secondary" onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <Card>
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Status</label>
            <Select
              className="mt-2"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="">All statuses</option>
              {["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Laboratory</label>
            <Select
              className="mt-2"
              value={laboratoryFilter}
              onChange={(event) => setLaboratoryFilter(event.target.value)}
            >
              <option value="">All laboratories</option>
              {laboratoryOptions.map((laboratory) => (
                <option key={laboratory} value={laboratory}>
                  {laboratory}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">From</label>
            <Input
              className="mt-2"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">To</label>
            <Input
              className="mt-2"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard title="Total Reservations" value={summary.total} helper="After filters" icon={LayoutList} />
        <StatCard title="Pending" value={summary.pending} helper="Awaiting staff review" icon={TimerReset} />
        <StatCard title="Approved" value={summary.approved} helper="Ready for laboratory use" icon={CheckCircle2} />
        <StatCard
          title="Completed"
          value={summary.completed}
          helper="Sessions already completed"
          icon={CalendarRange}
        />
        <StatCard
          title="Most Used Lab"
          value={summary.mostUsedLab[1]}
          helper={summary.mostUsedLab[0] === "-" ? "No usage data" : summary.mostUsedLab[0]}
          icon={MapPinned}
        />
        <StatCard
          title="Busiest Hour"
          value={summary.busiestHour[1]}
          helper={summary.busiestHour[0] === "-" ? "No usage data" : summary.busiestHour[0]}
          icon={Flame}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold text-slate-900">Reservation Status Mix</h2>
          <p className="mt-2 text-sm text-slate-500">
            Snapshot of filtered reservation statuses.
          </p>
          <div className="mt-6 h-80">
            {reservationsByStatus.length ? (
              <Doughnut
                data={statusChartData}
                options={{
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "bottom"
                    }
                  }
                }}
              />
            ) : (
              <EmptyState
                title="No chart data"
                description="Adjust the report filters or wait for reservations to be created."
              />
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-slate-900">Top Laboratory Demand</h2>
          <p className="mt-2 text-sm text-slate-500">
            Most frequently requested laboratories in the current filter range.
          </p>
          <div className="mt-6 h-80">
            {reservationsByLaboratory.length ? (
              <Bar
                data={laboratoryChartData}
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
                title="No utilization data"
                description="As reservations are created, laboratory demand will appear here."
              />
            )}
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Filtered Reservation Register</h2>
            <p className="mt-1 text-sm text-slate-500">
              Detailed reservation rows for the current report view.
            </p>
          </div>
          {dashboardData?.recentActivity?.length ? (
            <p className="text-sm text-slate-500">
              Recent activity entries loaded: {dashboardData.recentActivity.length}
            </p>
          ) : null}
        </div>

        {isLoading ? (
          <div className="mt-6 space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-20 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredReservations.length ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Code</th>
                  <th className="py-3 pr-4">Student</th>
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Schedule</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReservations.slice(0, 12).map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="py-4 pr-4 font-semibold text-slate-900">
                      {reservation.reservationCode}
                    </td>
                    <td className="py-4 pr-4">
                      {fullName(reservation.student?.firstName, reservation.student?.lastName)}
                    </td>
                    <td className="py-4 pr-4">
                      {reservation.laboratory?.roomCode} | {reservation.laboratory?.name}
                    </td>
                    <td className="py-4 pr-4">
                      <p>{formatDate(reservation.reservationDate)}</p>
                      <p className="mt-1 text-slate-500">
                        {formatTimeRange(reservation.startTime, reservation.endTime)}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={reservation.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-6">
            <EmptyState
              title="No filtered report rows"
              description="Try adjusting the date, status, or laboratory filters to broaden the dataset."
            />
          </div>
        )}
      </Card>
    </div>
  );
};
