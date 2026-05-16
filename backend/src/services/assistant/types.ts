import type {
  LaboratoryStatus,
  ReservationStatus,
  ReservationType,
  UserRole
} from "@prisma/client";

export type AssistantLanguage = "english" | "tagalog" | "taglish";

export type AssistantCategory =
  | "current_user"
  | "available_schedules"
  | "available_laboratories"
  | "specific_laboratory"
  | "my_reservations"
  | "notifications"
  | "admin_stats"
  | "approval_queue"
  | "recent_activity"
  | "system_info"
  | "user_directory"
  | "reservation_submitter"
  | "reservation_rules"
  | "laboratory_lookup"
  | "general_reservation_help"
  | "out_of_scope";

export type CurrentUser = {
  id: number;
  sessionId: number;
  role: UserRole;
};

export type TimeWindow = {
  startTime: string;
  endTime: string;
};

export type DateRange = {
  start: Date;
  end: Date;
  label: string;
  granularity: "day" | "week" | "month" | "range";
  monthIndex?: number;
  year?: number;
  source: "explicit" | "context" | "default";
};

export type LaboratorySummary = {
  id: number;
  name: string;
  roomCode: string;
  building: string;
  location: string | null;
  capacity: number;
  computerCount: number;
  description: string;
  status: LaboratoryStatus;
};

export type ScheduleAvailability = {
  laboratoryId: number;
  laboratoryName: string;
  roomCode: string;
  building: string;
  date: string;
  scheduleWindow: string;
  freeWindows: TimeWindow[];
};

export type CalendarNote = {
  date: string;
  title: string;
  type: string;
  laboratory?: string | null;
  timeWindow?: string | null;
};

export type ReservationSummary = {
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
};

export type ReservationRule = {
  title: string;
  detail: string;
};

export type CurrentUserContextResult = {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  studentNumber: string | null;
  yearLevel: number | null;
  department: string | null;
  verificationStatus: "verified" | "unverified";
  createdAt: string;
};

export type NotificationSummary = {
  id: number;
  subject: string;
  message: string;
  type: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationsContextResult = {
  unreadCount: number;
  notifications: NotificationSummary[];
};

export type SystemStatItem = {
  label: string;
  value: number;
};

export type SystemStatsContextResult = {
  scope: "admin" | "staff";
  stats: SystemStatItem[];
  recentReservations: ReservationSummary[];
};

export type ActivitySummary = {
  id: number;
  timestamp: string;
  action: string;
  description: string;
  actorName: string | null;
  actorRole: UserRole | null;
  laboratoryRoomCode: string | null;
};

export type RecentActivityContextResult = {
  scope: "admin" | "staff";
  activities: ActivitySummary[];
};

export type StaffDirectoryEntry = {
  id: number;
  name: string;
  role: UserRole;
  assignedLaboratories: string[];
};

export type StaffDirectoryContextResult = {
  users: StaffDirectoryEntry[];
};

export type SystemInfoContextResult = {
  summary: string;
};

export type AssistantConversationMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  category?: AssistantCategory;
};

export type AssistantQuerySnapshot = {
  category: AssistantCategory;
  range: DateRange;
  laboratory: LaboratorySummary | null;
  language: AssistantLanguage;
  resultOffset: number;
  hasMore: boolean;
};

export type AssistantConversationContext = {
  sessionKey: string;
  userId: number;
  sessionId: number;
  language: AssistantLanguage;
  messages: AssistantConversationMessage[];
  activeQuery: AssistantQuerySnapshot | null;
  updatedAt: number;
};

export type AssistantPresentation =
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
          availableSlots: TimeWindow[];
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
        nextOpenWindows: Array<TimeWindow & { date: string }>;
      }>;
    }
  | {
      type: "reservation-results";
      title: string;
      reservations: ReservationSummary[];
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
      notifications: NotificationSummary[];
    }
  | {
      type: "stats";
      title: string;
      scope: "admin" | "staff";
      items: SystemStatItem[];
    }
  | {
      type: "activity-results";
      title: string;
      scope: "admin" | "staff";
      activities: ActivitySummary[];
    }
  | {
      type: "user-list";
      title: string;
      users: StaffDirectoryEntry[];
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
      type: "rules";
      title: string;
      items: ReservationRule[];
    };

export type ReservationAssistantResponse = {
  reply: string;
  mode: "ai" | "fallback";
  category: AssistantCategory;
  suggestions: string[];
  presentation?: AssistantPresentation;
};

export type IntentAnalysis = {
  category: AssistantCategory;
  range: DateRange;
  laboratory: LaboratorySummary | null;
  language: AssistantLanguage;
  isFollowUp: boolean;
  isShowMore: boolean;
  normalizedMessage: string;
  previousQuery: AssistantQuerySnapshot | null;
};

export type ScheduleAvailabilityResult = {
  rangeLabel: string;
  schedules: ScheduleAvailability[];
  totalCount: number;
  hasMore: boolean;
  calendarNotes: CalendarNote[];
};

export type LaboratoryAvailabilityResult = {
  rangeLabel: string;
  laboratories: Array<{
    laboratoryName: string;
    roomCode: string;
    building: string;
    nextOpenWindows: Array<TimeWindow & { date: string }>;
  }>;
  totalCount: number;
  hasMore: boolean;
  calendarNotes: CalendarNote[];
};

export type LaboratoryLookupResult = {
  laboratory: LaboratorySummary;
};

export type ReservationResultsContext = {
  rangeLabel: string;
  reservations: ReservationSummary[];
};

export type GeneralHelpContext = {
  rangeLabel: string;
  availableLaboratories: number;
  scheduleCount: number;
};
