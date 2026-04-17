import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";

import { reservationApi } from "../../api/services";
import type { Reservation } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { formatDate, formatTimeRange } from "../../utils/format";

export const ReservationManagementPage = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [remarks, setRemarks] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationApi.list
  });

  const reservations = useMemo(() => {
    return (data ?? []).filter((reservation) =>
      statusFilter ? reservation.status === statusFilter : true
    );
  }, [data, statusFilter]);

  const refreshReservations = async () => {
    await queryClient.invalidateQueries({ queryKey: ["reservations"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    setSelectedReservation(null);
    setRemarks("");
  };

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      status,
      remarks: message
    }: {
      id: number;
      status: "APPROVED" | "REJECTED";
      remarks?: string;
    }) => reservationApi.review(id, { status, remarks: message }),
    onSuccess: async (_data, variables) => {
      toast.success(
        `Reservation ${variables.status === "APPROVED" ? "approved" : "rejected"}.`
      );
      await refreshReservations();
    },
    onError: () => toast.error("Unable to review reservation.")
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, remarks: message }: { id: number; remarks?: string }) =>
      reservationApi.complete(id, message),
    onSuccess: async () => {
      toast.success("Reservation marked as completed.");
      await refreshReservations();
    },
    onError: () => toast.error("Unable to complete reservation.")
  });

  return (
    <div>
      <PageHeader
        title="Reservation Management"
        description="Review incoming requests, add remarks, and update reservation progress after laboratory use."
      />

      <Card className="mb-6">
        <div className="max-w-xs">
          <label className="text-sm font-medium text-slate-700">Filter by Status</label>
          <Select className="mt-2" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Statuses</option>
            {["PENDING", "APPROVED", "REJECTED", "CANCELLED", "COMPLETED"].map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div>Loading reservations...</div>
        ) : reservations.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Reservation</th>
                  <th className="py-3 pr-4">Student</th>
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Schedule</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-slate-900">{reservation.reservationCode}</p>
                      <p className="mt-1 text-slate-500">{reservation.purpose}</p>
                    </td>
                    <td className="py-4 pr-4">
                      {reservation.student?.firstName} {reservation.student?.lastName}
                      <p className="mt-1 text-slate-500">{reservation.student?.studentNumber}</p>
                    </td>
                    <td className="py-4 pr-4">
                      {reservation.laboratory?.roomCode}
                      <p className="mt-1 text-slate-500">{reservation.laboratory?.name}</p>
                    </td>
                    <td className="py-4 pr-4">
                      <p>{formatDate(reservation.reservationDate)}</p>
                      <p className="mt-1 text-slate-500">
                        {formatTimeRange(reservation.startTime, reservation.endTime)}
                      </p>
                    </td>
                    <td className="py-4 pr-4">
                      <StatusBadge status={reservation.status} />
                      {reservation.remarks ? (
                        <p className="mt-2 text-slate-500">{reservation.remarks}</p>
                      ) : null}
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        {reservation.status === "PENDING" ? (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedReservation(reservation);
                              setRemarks(reservation.remarks ?? "");
                            }}
                          >
                            Review
                          </Button>
                        ) : null}
                        {reservation.status === "APPROVED" ? (
                          <Button
                            onClick={() =>
                              completeMutation.mutate({
                                id: reservation.id,
                                remarks: reservation.remarks ?? undefined
                              })
                            }
                          >
                            Mark Complete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No reservations found"
            description="Reservation requests will appear here once students begin booking laboratory slots."
          />
        )}
      </Card>

      <Modal
        open={Boolean(selectedReservation)}
        title="Review Reservation"
        onClose={() => {
          setSelectedReservation(null);
          setRemarks("");
        }}
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">
              {selectedReservation?.reservationCode}
            </p>
            <p className="mt-2">{selectedReservation?.purpose}</p>
            <p className="mt-2">
              {selectedReservation
                ? `${formatDate(selectedReservation.reservationDate)} | ${formatTimeRange(
                    selectedReservation.startTime,
                    selectedReservation.endTime
                  )}`
                : ""}
            </p>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Remarks</span>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Add approval or rejection notes for the student."
            />
          </label>
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedReservation(null);
                setRemarks("");
              }}
            >
              Close
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                selectedReservation
                  ? reviewMutation.mutate({
                      id: selectedReservation.id,
                      status: "REJECTED",
                      remarks
                    })
                  : undefined
              }
            >
              Reject
            </Button>
            <Button
              onClick={() =>
                selectedReservation
                  ? reviewMutation.mutate({
                      id: selectedReservation.id,
                      status: "APPROVED",
                      remarks
                    })
                  : undefined
              }
            >
              Approve
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
