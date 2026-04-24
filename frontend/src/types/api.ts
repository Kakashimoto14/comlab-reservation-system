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
export type ReservationType = "LAB" | "PC";
export type PCStatus = "AVAILABLE" | "OCCUPIED" | "MAINTENANCE";
export type CalendarEventType = "MAINTENANCE" | "HOLIDAY";

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
  assignedLaboratories?: Array<Pick<Laboratory, "id" | "name" | "roomCode">>;
  createdAt: string;
  updatedAt: string;
};

export type Laboratory = {
  id: number;
  name: string;
  roomCode: string;
  building: string;
  location?: string | null;
  capacity: number;
  computerCount: number;
  description: string;
  status: LaboratoryStatus;
  imageUrl?: string | null;
  custodianId?: number | null;
  custodian?: Pick<User, "id" | "firstName" | "lastName" | "email" | "department" | "role" | "status"> | null;
  _count?: {
    pcs?: number;
    schedules?: number;
    reservations?: number;
  };
  createdAt: string;
  updatedAt: string;
};

export type PC = {
  id: number;
  laboratoryId: number;
  pcNumber: string;
  status: PCStatus;
  createdAt: string;
  updatedAt: string;
  laboratory?: Laboratory;
  reservations?: Array<Pick<Reservation, "id" | "reservationCode" | "reservationDate" | "startTime" | "endTime" | "status">>;
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
  | "id"
  | "scheduleId"
  | "pcId"
  | "reservationType"
  | "reservationDate"
  | "startTime"
  | "endTime"
  | "status"
  | "reservationCode"
>;

export type Reservation = {
  id: number;
  reservationCode: string;
  studentId: number;
  laboratoryId: number;
  scheduleId?: number | null;
  pcId?: number | null;
  reservationType: ReservationType;
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
  pc?: PC | null;
  reviewedBy?: Pick<User, "id" | "firstName" | "lastName" | "role">;
};

export type ActivityLog = {
  id: number;
  userId?: number | null;
  labId?: number | null;
  pcId?: number | null;
  action: string;
  entityType: string;
  entityId?: number | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
  createdAt: string;
  user?: Pick<User, "id" | "firstName" | "lastName" | "role">;
  laboratory?: Pick<Laboratory, "id" | "name" | "roomCode"> | null;
  pc?: Pick<PC, "id" | "pcNumber" | "status"> | null;
};

export type LaboratoryAvailability = {
  id: number;
  name: string;
  roomCode: string;
  building: string;
  location?: string | null;
  status: LaboratoryStatus;
  custodian?: Pick<User, "id" | "firstName" | "lastName"> | null;
  availableScheduleCount: number;
  totalPcCount: number;
  occupiedPcCount: number;
  reservationLoad: number;
  availabilityStatus: LaboratoryStatus | "FULLY_BOOKED" | "PCS_FULL" | "OPEN";
};

export type CalendarDisplayEvent = {
  id: number;
  source: "CALENDAR_EVENT" | "SCHEDULE" | "RESERVATION";
  editable: boolean;
  title: string;
  type: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  description?: string | null;
  laboratory?: Laboratory | null;
  pc?: PC | null;
};

export type CalendarResponse = {
  customEvents: CalendarDisplayEvent[];
  derivedEvents: CalendarDisplayEvent[];
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
