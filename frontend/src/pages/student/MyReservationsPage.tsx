import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import toast from "react-hot-toast";

import { reservationApi } from "../../api/services";
import type { Reservation } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatTimeRange } from "../../utils/format";

export const MyReservationsPage = () => {
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationApi.list
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => reservationApi.cancel(id),
    onSuccess: () => {
      toast.success("Reservation cancelled.");
      setSelectedReservation(null);
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: () => toast.error("Unable to cancel this reservation.")
  });

  return (
    <div>
      <PageHeader
        title="My Reservations"
        description="Monitor your requests, check approval remarks, and cancel pending bookings when necessary."
      />

      <Card>
        {isLoading ? (
          <div>Loading reservations...</div>
        ) : data?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-3 pr-4">Reservation</th>
                  <th className="py-3 pr-4">Laboratory</th>
                  <th className="py-3 pr-4">Schedule</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.map((reservation) => (
                  <tr key={reservation.id}>
                    <td className="py-4 pr-4 align-top">
                      <p className="font-semibold text-slate-900">{reservation.reservationCode}</p>
                      <p className="mt-1 text-slate-500">{reservation.purpose}</p>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      {reservation.laboratory?.name}
                      <p className="mt-1 text-slate-500">{reservation.laboratory?.roomCode}</p>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <p>{formatDate(reservation.reservationDate)}</p>
                      <p className="mt-1 text-slate-500">
                        {formatTimeRange(reservation.startTime, reservation.endTime)}
                      </p>
                    </td>
                    <td className="py-4 pr-4 align-top">
                      <StatusBadge status={reservation.status} />
                      {reservation.remarks ? (
                        <p className="mt-2 text-slate-500">{reservation.remarks}</p>
                      ) : null}
                    </td>
                    <td className="py-4 align-top">
                      {reservation.status === "PENDING" ? (
                        <Button
                          variant="danger"
                          onClick={() => setSelectedReservation(reservation)}
                        >
                          Cancel
                        </Button>
                      ) : (
                        <span className="text-slate-400">No actions</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No reservations found"
            description="Your submitted reservation requests will appear here once you create one."
          />
        )}
      </Card>

      <Modal
        open={Boolean(selectedReservation)}
        title="Cancel Reservation"
        onClose={() => setSelectedReservation(null)}
      >
        <p className="text-sm leading-7 text-slate-500">
          Are you sure you want to cancel reservation{" "}
          <span className="font-semibold text-slate-900">
            {selectedReservation?.reservationCode}
          </span>
          ?
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setSelectedReservation(null)}>
            Keep Reservation
          </Button>
          <Button
            variant="danger"
            onClick={() =>
              selectedReservation
                ? cancelMutation.mutate(selectedReservation.id)
                : undefined
            }
          >
            Confirm Cancel
          </Button>
        </div>
      </Modal>
    </div>
  );
};
