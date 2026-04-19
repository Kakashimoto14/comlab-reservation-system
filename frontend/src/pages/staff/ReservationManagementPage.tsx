import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AxiosError } from "axios";
import {
  CheckCircle2,
  ClipboardList,
  Clock3,
  Download,
  Search,
  ShieldCheck
} from "lucide-react";
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
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Textarea } from "../../components/ui/Textarea";
import { downloadCsv } from "../../utils/csv";
import { formatDate, formatDateTime, formatTimeRange, fullName } from "../../utils/format";

const PAGE_SIZE = 8;

const getErrorMessage = (error: unknown, fallbackMessage: string) => {
  if (error instanceof AxiosError) {
    return (
      (error.response?.data as { message?: string } | undefined)?.message ?? fallbackMessage
    );
  }

  return fallbackMessage;
};

export const ReservationManagementPage = () => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("");
  const [laboratoryFilter, setLaboratoryFilter] = useState("");
  const [studentFilter, setStudentFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [remarks, setRemarks] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["reservations"],
    queryFn: reservationApi.list
  });

  const reservations = data ?? [];

  const reservationTotals = useMemo(
    () => ({
      total: reservations.length,
      pending: reservations.filter((reservation) => reservation.status === "PENDING").length,
      approved: reservations.filter((reservation) => reservation.status === "APPROVED").length,
      completed: reservations.filter((reservation) => reservation.status === "COMPLETED").length
    }),
    [reservations]
  );

  const laboratories = useMemo(
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
    const normalizedStudent = studentFilter.trim().toLowerCase();

    const filtered = reservations.filter((reservation) => {
      const matchesStatus = statusFilter ? reservation.status === statusFilter : true;
      const matchesLaboratory = laboratoryFilter
        ? reservation.laboratory?.roomCode === laboratoryFilter
        : true;
      const matchesStudent = normalizedStudent
        ? [
            reservation.student?.firstName,
            reservation.student?.lastName,
            reservation.student?.studentNumber,
            reservation.reservationCode
          ]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(normalizedStudent))
        : true;
      const matchesDate = dateFilter
        ? reservation.reservationDate.slice(0, 10) === dateFilter
        : true;

      return matchesStatus && matchesLaboratory && matchesStudent && matchesDate;
    });

    return filtered.sort((left, right) => {
      switch (sortBy) {
        case "date-asc":
          return `${left.reservationDate}-${left.startTime}`.localeCompare(
            `${right.reservationDate}-${right.startTime}`
          );
        case "student-asc":
          return fullName(left.student?.firstName, left.student?.lastName).localeCompare(
            fullName(right.student?.firstName, right.student?.lastName)
          );
        case "laboratory-asc":
          return (left.laboratory?.roomCode ?? "").localeCompare(
            right.laboratory?.roomCode ?? ""
          );
        case "status-asc":
          return left.status.localeCompare(right.status);
        default:
          return `${right.reservationDate}-${right.startTime}`.localeCompare(
            `${left.reservationDate}-${left.startTime}`
          );
      }
    });
  }, [dateFilter, laboratoryFilter, reservations, sortBy, statusFilter, studentFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / PAGE_SIZE));

  const paginatedReservations = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredReservations.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, filteredReservations]);

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
    onError: (error) => toast.error(getErrorMessage(error, "Unable to review reservation."))
  });

  const completeMutation = useMutation({
    mutationFn: ({ id, remarks: message }: { id: number; remarks?: string }) =>
      reservationApi.complete(id, message),
    onSuccess: async () => {
      toast.success("Reservation marked as completed.");
      await refreshReservations();
    },
    onError: (error) => toast.error(getErrorMessage(error, "Unable to complete reservation."))
  });

  const exportCurrentView = () => {
    downloadCsv(
      "reservation-management-report.csv",
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
    toast.success("Reservation report exported.");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reservation Management"
        description="Review incoming requests, filter large reservation datasets, and move bookings through the approval workflow."
        actions={
          <Button variant="secondary" onClick={exportCurrentView}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Reservations"
          value={reservationTotals.total}
          helper="Current reservation records"
          icon={ClipboardList}
        />
        <StatCard
          title="Pending"
          value={reservationTotals.pending}
          helper="Waiting for review"
          icon={Clock3}
        />
        <StatCard
          title="Approved"
          value={reservationTotals.approved}
          helper="Approved for laboratory use"
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
        <div className="grid gap-4 xl:grid-cols-[1.3fr_repeat(4,minmax(0,1fr))]">
          <div>
            <label className="text-sm font-medium text-slate-700">Student or code</label>
            <div className="relative mt-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-10"
                value={studentFilter}
                onChange={(event) => {
                  setStudentFilter(event.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by student or reservation code"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Status</label>
            <Select
              className="mt-2"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setCurrentPage(1);
              }}
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
              onChange={(event) => {
                setLaboratoryFilter(event.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">All laboratories</option>
              {laboratories.map((laboratory) => (
                <option key={laboratory} value={laboratory}>
                  {laboratory}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Date</label>
            <Input
              className="mt-2"
              type="date"
              value={dateFilter}
              onChange={(event) => {
                setDateFilter(event.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Sort</label>
            <Select
              className="mt-2"
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <option value="date-desc">Newest first</option>
              <option value="date-asc">Oldest first</option>
              <option value="student-asc">Student A-Z</option>
              <option value="laboratory-asc">Laboratory A-Z</option>
              <option value="status-asc">Status A-Z</option>
            </Select>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        ) : filteredReservations.length ? (
          <>
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
                  {paginatedReservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td className="py-4 pr-4 align-top">
                        <p className="font-semibold text-slate-900">{reservation.reservationCode}</p>
                        <p className="mt-1 text-slate-500">{reservation.purpose}</p>
                      </td>
                      <td className="py-4 pr-4 align-top">
                        {fullName(reservation.student?.firstName, reservation.student?.lastName)}
                        <p className="mt-1 text-slate-500">{reservation.student?.studentNumber}</p>
                      </td>
                      <td className="py-4 pr-4 align-top">
                        {reservation.laboratory?.roomCode}
                        <p className="mt-1 text-slate-500">{reservation.laboratory?.name}</p>
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
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setSelectedReservation(reservation);
                              setRemarks(reservation.remarks ?? "");
                            }}
                          >
                            View
                          </Button>
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

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-500">
                Showing {(currentPage - 1) * PAGE_SIZE + 1}-
                {Math.min(currentPage * PAGE_SIZE, filteredReservations.length)} of{" "}
                {filteredReservations.length} reservations
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((page) => page - 1)}
                >
                  Previous
                </Button>
                <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-medium text-slate-600">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((page) => page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            title={reservations.length ? "No reservations match the current filters" : "No reservations found"}
            description={
              reservations.length
                ? "Adjust the date, laboratory, status, or student search to broaden the result set."
                : "Reservation requests will appear here once students begin booking laboratory slots."
            }
          />
        )}
      </Card>

      <Modal
        open={Boolean(selectedReservation)}
        title="Reservation Details"
        onClose={() => {
          setSelectedReservation(null);
          setRemarks("");
        }}
      >
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reservation
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedReservation?.reservationCode}
              </p>
              <p className="mt-1 text-slate-500">{selectedReservation?.purpose}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Student
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {fullName(
                  selectedReservation?.student?.firstName,
                  selectedReservation?.student?.lastName
                )}
              </p>
              <p className="mt-1 text-slate-500">{selectedReservation?.student?.studentNumber}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Laboratory
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedReservation?.laboratory?.name}
              </p>
              <p className="mt-1 text-slate-500">{selectedReservation?.laboratory?.roomCode}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Schedule
              </p>
              <p className="mt-2 font-semibold text-slate-900">
                {selectedReservation ? formatDate(selectedReservation.reservationDate) : ""}
              </p>
              <p className="mt-1 text-slate-500">
                {selectedReservation
                  ? formatTimeRange(
                      selectedReservation.startTime,
                      selectedReservation.endTime
                    )
                  : ""}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="font-semibold text-slate-900">Current Status</p>
              {selectedReservation ? <StatusBadge status={selectedReservation.status} /> : null}
            </div>
            {selectedReservation?.reviewedBy ? (
              <p className="mt-2 text-sm text-slate-500">
                Reviewed by{" "}
                <span className="font-medium text-slate-700">
                  {fullName(
                    selectedReservation.reviewedBy.firstName,
                    selectedReservation.reviewedBy.lastName
                  )}
                </span>{" "}
                on {selectedReservation.reviewedAt ? formatDateTime(selectedReservation.reviewedAt) : "N/A"}
              </p>
            ) : null}
          </div>

          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-700">Remarks</span>
            <Textarea
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
              placeholder="Add approval or rejection notes for the student."
            />
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              variant="secondary"
              onClick={() => {
                setSelectedReservation(null);
                setRemarks("");
              }}
            >
              Close
            </Button>
            {selectedReservation?.status === "PENDING" ? (
              <>
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
              </>
            ) : null}
          </div>
        </div>
      </Modal>
    </div>
  );
};
