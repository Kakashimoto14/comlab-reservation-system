import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AxiosError } from "axios";
import { CheckCircle2, ClipboardList, Clock3, ShieldCheck } from "lucide-react";

import { reservationApi } from "../../api/services";
import type { Reservation } from "../../types/api";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { PageHeader } from "../../components/ui/PageHeader";
import { Select } from "../../components/ui/Select";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDate, formatDateTime, formatTimeRange, fullName } from "../../utils/format";

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage
    );
  }

  return fallbackMessage;
};

export const MyReservationsPage = () => {
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationApi.list
  });

  const reservations = data ?? [];

  const filteredReservations = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return reservations.filter((reservation) => {
      const matchesStatus = statusFilter ? reservation.status === statusFilter : true;
      const matchesSearch = normalizedSearch
        ? [
            reservation.reservationCode,
            reservation.purpose,
            reservation.laboratory?.name,
            reservation.laboratory?.roomCode,
            reservation.remarks
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedSearch))
        : true;

      return matchesStatus && matchesSearch;
    });
  }, [reservations, searchTerm, statusFilter]);

  const reservationTotals = useMemo(
    () => ({
      total: reservations.length,
      pending: reservations.filter((reservation) => reservation.status === "PENDING").length,
      approved: reservations.filter((reservation) => reservation.status === "APPROVED").length,
      completed: reservations.filter((reservation) => reservation.status === "COMPLETED").length
    }),
    [reservations]
  );

  const cancelMutation = useMutation({
    mutationFn: (id: number) => reservationApi.cancel(id),
    onSuccess: () => {
      toast.success("Reservation cancelled.");
      setSelectedReservation(null);
      void queryClient.invalidateQueries({ queryKey: ["reservations"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Unable to cancel this reservation."))
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Reservations"
        description="Track your request history, approval remarks, review staff decisions, and cancel pending bookings when needed."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Requests"
          value={reservationTotals.total}
          helper="All reservation submissions on your account"
          icon={ClipboardList}
        />
        <StatCard
          title="Pending"
          value={reservationTotals.pending}
          helper="Still waiting for staff review"
          icon={Clock3}
        />
        <StatCard
          title="Approved"
          value={reservationTotals.approved}
          helper="Ready for scheduled laboratory use"
          icon={ShieldCheck}
        />
        <StatCard
          title="Completed"
          value={reservationTotals.completed}
          helper="Finished laboratory sessions"
          icon={CheckCircle2}
        />
      </div>

      <Card>
        <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
          <div>
            <label className="text-sm font-medium text-slate-700">Search reservations</label>
            <Input
              className="mt-2"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by code, purpose, laboratory, or remarks"
            />
          </div>
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
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredReservations.length ? (
          <div className="space-y-4">
            {filteredReservations.map((reservation) => (
              <div
                key={reservation.id}
                className="rounded-3xl border border-slate-200 p-5 transition hover:border-brand-200 hover:bg-brand-50/40"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-lg font-semibold text-slate-900">
                        {reservation.reservationCode}
                      </p>
                      <StatusBadge status={reservation.status} />
                    </div>
                    <p className="text-sm leading-7 text-slate-600">{reservation.purpose}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {reservation.status === "PENDING" ? (
                      <Button variant="danger" onClick={() => setSelectedReservation(reservation)}>
                        Cancel Request
                      </Button>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 text-sm text-slate-600 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Laboratory
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {reservation.laboratory?.name ?? "Unknown laboratory"}
                    </p>
                    <p className="mt-1 text-slate-500">{reservation.laboratory?.roomCode}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Reservation Type
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">{reservation.reservationType}</p>
                    <p className="mt-1 text-slate-500">
                      {reservation.pc?.pcNumber ?? "Whole laboratory"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Schedule
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {formatDate(reservation.reservationDate)}
                    </p>
                    <p className="mt-1 text-slate-500">
                      {formatTimeRange(reservation.startTime, reservation.endTime)}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Review Remarks
                    </p>
                    <p className="mt-2 text-slate-600">
                      {reservation.remarks || "No remarks have been added yet."}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Last Updated
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {formatDateTime(reservation.updatedAt)}
                    </p>
                    <p className="mt-1 text-slate-500">
                      Reviewer:{" "}
                      {reservation.reviewedBy
                        ? fullName(
                            reservation.reviewedBy.firstName,
                            reservation.reviewedBy.lastName
                          )
                        : "Waiting for review"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title={reservations.length ? "No reservations match your filters" : "No reservations found"}
            description={
              reservations.length
                ? "Try another status or keyword to find your reservation history faster."
                : "Your submitted reservation requests will appear here once you create one."
            }
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
          ? This action is only allowed while the request is still pending.
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
