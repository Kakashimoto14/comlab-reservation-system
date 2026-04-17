import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { dashboardApi, reservationApi } from "../../api/services";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";

export const ReportsPage = () => {
  const { data: dashboardData } = useQuery({
    queryKey: ["dashboard"],
    queryFn: dashboardApi.get
  });

  const { data: reservations } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationApi.list
  });

  const reservationsByLaboratory = useMemo(() => {
    const counts = new Map<string, number>();

    (reservations ?? []).forEach((reservation) => {
      const key = reservation.laboratory?.roomCode ?? "Unknown";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([laboratory, count]) => ({ laboratory, count }));
  }, [reservations]);

  return (
    <div>
      <PageHeader
        title="Reports"
        description="A compact reporting view for panel demonstrations, including overall status counts and high-use laboratories."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-semibold text-slate-900">Reservation Status Summary</h2>
          {dashboardData?.reservationsByStatus?.length ? (
            <div className="mt-6 space-y-4">
              {dashboardData.reservationsByStatus.map((item) => (
                <div
                  key={item.status}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
                >
                  <StatusBadge status={item.status as never} />
                  <p className="text-lg font-semibold text-slate-900">{item._count.status}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No summary data yet"
                description="Once reservations exist, this report will show the status distribution."
              />
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-xl font-semibold text-slate-900">Most Requested Laboratories</h2>
          {reservationsByLaboratory.length ? (
            <div className="mt-6 space-y-4">
              {reservationsByLaboratory.map((item) => (
                <div
                  key={item.laboratory}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 p-4"
                >
                  <p className="font-medium text-slate-800">{item.laboratory}</p>
                  <p className="text-lg font-semibold text-brand-700">{item.count}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <EmptyState
                title="No laboratory usage data"
                description="As reservations are created, laboratory demand will appear here."
              />
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-xl font-semibold text-slate-900">Recent Reservation Register</h2>
        {reservations?.length ? (
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Code</th>
                  <th className="py-3 pr-4">Student</th>
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.slice(0, 10).map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="py-4 pr-4 font-semibold text-slate-900">
                      {reservation.reservationCode}
                    </td>
                    <td className="py-4 pr-4">
                      {reservation.student?.firstName} {reservation.student?.lastName}
                    </td>
                    <td className="py-4 pr-4">{reservation.laboratory?.roomCode}</td>
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
              title="No reservation register"
              description="This report will populate after the first successful reservation requests."
            />
          </div>
        )}
      </Card>
    </div>
  );
};
