export type UserRole = "ADMIN" | "STUDENT" | "LABORATORY_STAFF";
export type UserStatus = "ACTIVE" | "DEACTIVATED";
export type LaboratoryStatus = "AVAILABLE" | "UNAVAILABLE" | "MAINTENANCE";
export type ScheduleStatus = "AVAILABLE" | "BLOCKED" | "CLOSED";
export type ReservationStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "COMPLETED";

export type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  studentNumber?: string | null;
  department?: string | null;
  yearLevel?: number | null;
  phone?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Laboratory = {
  id: number;
  name: string;
  roomCode: string;
  building: string;
  capacity: number;
  computerCount: number;
  description: string;
  status: LaboratoryStatus;
  imageUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Schedule = {
  id: number;
  laboratoryId: number;
  date: string;
  startTime: string;
  endTime: string;
  status: ScheduleStatus;
  createdById: number;
  createdAt: string;
  updatedAt: string;
  laboratory?: Laboratory;
  createdBy?: Pick<User, "id" | "firstName" | "lastName" | "role">;
};

export type ReservationSlot = Pick<
  Reservation,
  "id" | "scheduleId" | "reservationDate" | "startTime" | "endTime" | "status" | "reservationCode"
>;

export type Reservation = {
  id: number;
  reservationCode: string;
  studentId: number;
  laboratoryId: number;
  scheduleId?: number | null;
  purpose: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  status: ReservationStatus;
  remarks?: string | null;
  reviewedById?: number | null;
  reviewedAt?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  student?: Pick<User, "id" | "firstName" | "lastName" | "email" | "studentNumber">;
  laboratory?: Laboratory;
  reviewedBy?: Pick<User, "id" | "firstName" | "lastName" | "role">;
};

export type ActivityLog = {
  id: number;
  userId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  description: string;
  createdAt: string;
  user?: Pick<User, "firstName" | "lastName" | "role">;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type PasswordActionResponse = {
  message: string;
  previewResetUrl?: string;
};

export type DashboardResponse = {
  scope: "admin" | "staff" | "student";
  totals: Record<string, number>;
  reservationsByStatus?: Array<{ status: string; _count: { status: number } }>;
  recentActivity?: ActivityLog[];
  recentReservations?: Reservation[];
  trends?: Array<{ date: string; count: number }>;
};
