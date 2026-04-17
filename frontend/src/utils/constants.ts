import type { ReservationStatus, UserRole } from "../types/api";

export const APP_NAME = "Web-Based Computer Laboratory Reservation System";
export const STORAGE_KEY = "comlab-auth";

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
