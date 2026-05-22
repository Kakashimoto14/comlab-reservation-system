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
export type CalendarSyncStatus = "NOT_ATTEMPTED" | "DISABLED" | "SYNCED" | "FAILED";
export type NotificationChannel = "EMAIL" | "IN_APP";
export type NotificationType =
  | "RESERVATION_CREATED"
  | "RESERVATION_CONFIRMED"
  | "RESERVATION_REJECTED"
  | "RESERVATION_CANCELLED"
  | "RESERVATION_REMINDER";
export type NotificationStatus = "PENDING" | "SENT" | "FAILED";

export type User = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  emailVerifiedAt?: string | null;
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
  googleCalendarEventId?: string | null;
  calendarSyncStatus: CalendarSyncStatus;
  calendarSyncError?: string | null;
  calendarSyncedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  student?: Pick<User, "id" | "firstName" | "lastName" | "email" | "studentNumber">;
  laboratory?: Laboratory;
  pc?: PC | null;
  reviewedBy?: Pick<User, "id" | "firstName" | "lastName" | "role">;
};

export type ReservationReviewResponse = Reservation & {
  calendarSyncMessage?: string;
  message?: string;
  reservation?: Reservation;
  notification?: {
    email: "sent" | "failed" | "skipped";
    realtime: "sent" | "failed" | "skipped";
  };
  calendar?: {
    status: "synced" | "failed" | "disabled" | "skipped";
    message: string;
  };
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
  user: User;
};

export type NotificationRecord = {
  id: number;
  userId: number;
  reservationId?: number | null;
  channel: NotificationChannel;
  type: NotificationType;
  status: NotificationStatus;
  subject: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  readAt?: string | null;
  sentAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationListResponse = {
  items: NotificationRecord[];
  unreadCount: number;
};

export type AuthActionResponse = {
  message: string;
  previewResetUrl?: string;
  previewVerificationUrl?: string;
};

export type DashboardResponse = {
  scope: "admin" | "staff" | "student";
  totals: Record<string, number>;
  reservationsByStatus?: Array<{ status: string; _count: { status: number } }>;
  recentActivity?: ActivityLog[];
  recentReservations?: Reservation[];
  trends?: Array<{ date: string; count: number }>;
};

export type ReservationAssistantCategory =
  | "current_user"
  | "available_schedules"
  | "available_laboratories"
  | "specific_laboratory"
  | "my_reservations"
  | "visible_reservations"
  | "notifications"
  | "admin_stats"
  | "approval_queue"
  | "recent_activity"
  | "system_info"
  | "user_directory"
  | "reservation_submitter"
  | "reservation_guide"
  | "reservation_rules"
  | "calendar_sync"
  | "laboratory_lookup"
  | "laboratory_catalog"
  | "usage_analytics"
  | "assigned_laboratory"
  | "role_capabilities"
  | "general_reservation_help"
  | "action_preview"
  | "action_completed"
  | "action_cancelled"
  | "clarification"
  | "permission_denied"
  | "out_of_scope";

export type AssistantConfirmationLevel = "LOW" | "MEDIUM" | "HIGH";
export type AssistantActionType =
  | "CREATE_RESERVATION"
  | "CANCEL_RESERVATION"
  | "APPROVE_RESERVATION"
  | "BULK_APPROVE_RESERVATIONS"
  | "REJECT_RESERVATION"
  | "BULK_REJECT_RESERVATIONS"
  | "CREATE_SCHEDULE"
  | "CREATE_BULK_SCHEDULE"
  | "UPDATE_SCHEDULE"
  | "DELETE_SCHEDULE"
  | "CREATE_LABORATORY"
  | "UPDATE_LABORATORY"
  | "DEACTIVATE_LABORATORY"
  | "DELETE_LABORATORY";

export type AssistantPendingAction = {
  actionId: string;
  actionType: AssistantActionType;
  title: string;
  summary: string;
  affectedCount: number;
  warnings: string[];
  requiredConfirmationLevel: AssistantConfirmationLevel;
  confirmationPhrase: string | null;
  expiresAt: string;
};

export type AssistantTimeWindow = {
  startTime: string;
  endTime: string;
};

export type ReservationAssistantPresentation =
  | {
      type: "schedule-results";
      title: string;
      showingCount: number;
      totalCount: number;
      hasMore: boolean;
      groups: Array<{
        date: string;
        laboratories: Array<{
          laboratoryName: string;
          roomCode: string;
          building: string;
          scheduleWindow: string;
          availableSlots: AssistantTimeWindow[];
        }>;
      }>;
    }
  | {
      type: "laboratory-results";
      title: string;
      showingCount: number;
      totalCount: number;
      hasMore: boolean;
      laboratories: Array<{
        laboratoryName: string;
        roomCode: string;
        building: string;
        nextOpenWindows: Array<AssistantTimeWindow & { date: string }>;
      }>;
    }
    | {
        type: "reservation-results";
        title: string;
        reservations: Array<{
          reservationCode: string;
        status: ReservationStatus;
        date: string;
        startTime: string;
        endTime: string;
        laboratoryName: string;
          roomCode: string;
          reservationType: ReservationType;
          pcNumber: string | null;
          purpose: string;
          studentName?: string | null;
          studentNumber?: string | null;
          remarks?: string | null;
          reviewedByName?: string | null;
          googleCalendarEventId?: string | null;
          calendarSyncStatus?: CalendarSyncStatus;
          calendarSyncError?: string | null;
          calendarSyncedAt?: string | null;
        }>;
      }
    | {
        type: "user-profile";
        title: string;
        user: {
          name: string;
          role: UserRole;
          email: string;
          studentNumber: string | null;
          yearLevel: number | null;
          department: string | null;
          verificationStatus: "verified" | "unverified";
          createdAt: string;
        };
      }
    | {
        type: "notification-results";
        title: string;
        unreadCount: number;
        notifications: Array<{
          id: number;
          subject: string;
          message: string;
          type: string;
          createdAt: string;
          readAt: string | null;
        }>;
      }
    | {
        type: "stats";
        title: string;
        scope: "admin" | "staff";
        items: Array<{
          label: string;
          value: number;
        }>;
      }
    | {
        type: "activity-results";
        title: string;
        scope: "admin" | "staff";
        activities: Array<{
          id: number;
          timestamp: string;
          action: string;
          description: string;
          actorName: string | null;
          actorRole: UserRole | null;
          laboratoryRoomCode: string | null;
        }>;
      }
    | {
        type: "user-list";
        title: string;
        users: Array<{
          id: number;
          name: string;
          role: UserRole;
          assignedLaboratories: string[];
        }>;
      }
  | {
      type: "laboratory-details";
      title: string;
      laboratory: {
        name: string;
        roomCode: string;
        building: string;
        location: string | null;
        capacity: number;
        computerCount: number;
        description: string;
        status: LaboratoryStatus;
      };
    }
  | {
      type: "laboratory-catalog";
      title: string;
      laboratories: Array<{
        id: number;
        name: string;
        roomCode: string;
        building: string;
        status: LaboratoryStatus;
        capacity: number;
        computerCount: number;
        assignedStaffName: string | null;
      }>;
    }
  | {
      type: "assigned-laboratory";
      title: string;
      laboratory:
        | {
            id: number;
            name: string;
            roomCode: string;
            building: string;
            status: LaboratoryStatus;
          }
        | null;
    }
  | {
      type: "summary";
      title: string;
      items: Array<{
        label: string;
        value: string;
      }>;
      notes?: string[];
    }
  | {
      type: "capabilities";
      title: string;
      role: UserRole;
      read: string[];
      write: string[];
      denied: string[];
      notes: string[];
    }
  | {
      type: "rules";
      title: string;
      items: Array<{
        title: string;
        detail: string;
      }>;
    };

export type ReservationAssistantResponse = {
  reply: string;
  mode: "ai" | "fallback";
  category: ReservationAssistantCategory;
  suggestions: string[];
  presentation?: ReservationAssistantPresentation;
  pendingAction?: AssistantPendingAction;
};
