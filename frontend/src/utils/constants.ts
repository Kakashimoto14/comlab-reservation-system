import type { ReservationStatus, UserRole } from "../types/api";

export const APP_SHORT_NAME = "ComPort";
export const APP_NAME = "ComPort Reservation System";
export const APP_TAGLINE = "Computer Laboratory Reservation Platform";

export const roleLabels: Record<UserRole, string> = {
  ADMIN: "Admin",
  STUDENT: "Student",
  LABORATORY_STAFF: "Laboratory Staff"
};

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed"
};
