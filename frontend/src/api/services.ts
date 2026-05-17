import type {
  ActivityLog,
  AuthActionResponse,
  AuthResponse,
  CalendarResponse,
  DashboardResponse,
  Laboratory,
  LaboratoryAvailability,
  NotificationListResponse,
  NotificationRecord,
  PC,
  Reservation,
  ReservationAssistantResponse,
  ReservationSlot,
  Schedule,
  User
} from "../types/api";
import { apiClient } from "./client";

export const authApi = {
  register: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<AuthActionResponse>("/auth/register", payload);
    return data;
  },
  login: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<AuthResponse>("/auth/login", payload);
    return data;
  },
  verifyEmail: async (payload: { token: string }) => {
    const { data } = await apiClient.post<AuthActionResponse>("/auth/verify-email", payload);
    return data;
  },
  resendVerification: async (payload: { email: string }) => {
    const { data } = await apiClient.post<AuthActionResponse>(
      "/auth/resend-verification",
      payload
    );
    return data;
  },
  forgotPassword: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<AuthActionResponse>(
      "/auth/forgot-password",
      payload
    );
    return data;
  },
  resetPassword: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<AuthActionResponse>(
      "/auth/reset-password",
      payload
    );
    return data;
  },
  changePassword: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<AuthActionResponse>(
      "/auth/change-password",
      payload
    );
    return data;
  },
  logout: async () => {
    const { data } = await apiClient.post<AuthActionResponse>("/auth/logout");
    return data;
  },
  me: async () => {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  }
};

export const userApi = {
  list: async () => {
    const { data } = await apiClient.get<User[]>("/users");
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<User>("/users", payload);
    return data;
  },
  update: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put<User>(`/users/${id}`, payload);
    return data;
  },
  updateStatus: async (id: number, status: string) => {
    const { data } = await apiClient.patch<User>(`/users/${id}/status`, { status });
    return data;
  },
  updateProfile: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.put<User>("/users/profile", payload);
    return data;
  }
};

export const laboratoryApi = {
  list: async () => {
    const { data } = await apiClient.get<Laboratory[]>("/laboratories");
    return data;
  },
  getById: async (id: number) => {
    const { data } = await apiClient.get<
      Laboratory & { schedules: Schedule[]; reservations: ReservationSlot[]; pcs: PC[] }
    >(`/laboratories/${id}`);
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<Laboratory>("/laboratories", payload);
    return data;
  },
  update: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put<Laboratory>(`/laboratories/${id}`, payload);
    return data;
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete<{ message: string }>(`/laboratories/${id}`);
    return data;
  },
  listAssignments: async (params?: Record<string, unknown>) => {
    const { data } = await apiClient.get<Laboratory[]>("/laboratories/assignments", { params });
    return data;
  },
  listStaffOptions: async () => {
    const { data } = await apiClient.get<User[]>("/laboratories/staff-options");
    return data;
  },
  assignStaff: async (id: number, custodianId: number | null) => {
    const { data } = await apiClient.put<Laboratory>(`/laboratories/${id}/custodian`, {
      custodianId
    });
    return data;
  },
  updatePcStatus: async (labId: number, pcId: number, status: string) => {
    const { data } = await apiClient.put<PC>(
      `/laboratories/${labId}/pcs/${pcId}/status`,
      { status }
    );
    return data;
  }
};

export const scheduleApi = {
  list: async (params?: Record<string, unknown>) => {
    const { data } = await apiClient.get<Schedule[]>("/schedules", { params });
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<Schedule>("/schedules", payload);
    return data;
  },
  update: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put<Schedule>(`/schedules/${id}`, payload);
    return data;
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete<{ message: string }>(`/schedules/${id}`);
    return data;
  }
};

export const reservationApi = {
  list: async () => {
    const { data } = await apiClient.get<Reservation[]>("/reservations");
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post<Reservation>("/reservations", payload);
    return data;
  },
  cancel: async (id: number) => {
    const { data } = await apiClient.patch<Reservation>(`/reservations/${id}/cancel`);
    return data;
  },
  review: async (
    id: number,
    payload: { status: "APPROVED" | "REJECTED"; remarks?: string }
  ) => {
    const { data } = await apiClient.patch<Reservation>(
      `/reservations/${id}/review`,
      payload
    );
    return data;
  },
  complete: async (id: number, remarks?: string) => {
    const { data } = await apiClient.patch<Reservation>(`/reservations/${id}/complete`, {
      remarks
    });
    return data;
  }
};

export const staffApi = {
  getMyLab: async () => {
    const { data } = await apiClient.get<Laboratory>("/staff/my-lab");
    return data;
  },
  getMyLabReservations: async () => {
    const { data } = await apiClient.get<Reservation[]>("/staff/my-lab/reservations");
    return data;
  },
  getMyLabSchedules: async () => {
    const { data } = await apiClient.get<Schedule[]>("/staff/my-lab/schedules");
    return data;
  },
  getMyLabLogs: async () => {
    const { data } = await apiClient.get<ActivityLog[]>("/staff/my-lab/logs");
    return data;
  },
  getMyLabPcs: async () => {
    const { data } = await apiClient.get<PC[]>("/staff/my-lab/pcs");
    return data;
  },
  listAvailability: async (params?: Record<string, unknown>) => {
    const { data } = await apiClient.get<LaboratoryAvailability[]>(
      "/staff/labs/availability",
      { params }
    );
    return data;
  },
  listPublicSchedules: async (params?: Record<string, unknown>) => {
    const { data } = await apiClient.get<Schedule[]>("/staff/labs/schedules/public", {
      params
    });
    return data;
  },
  updateMyLabReservation: async (
    id: number,
    payload: { status: "APPROVED" | "REJECTED"; remarks?: string }
  ) => {
    const { data } = await apiClient.put<Reservation>(`/staff/my-lab/reservation/${id}`, payload);
    return data;
  },
  updateMyLabSchedule: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put<Schedule>(`/staff/my-lab/schedule/${id}`, payload);
    return data;
  },
  updateMyLabPcStatus: async (id: number, status: string) => {
    const { data } = await apiClient.put<PC>(`/staff/my-lab/pcs/${id}/status`, {
      status
    });
    return data;
  }
};

export const calendarApi = {
  list: async (params?: Record<string, unknown>) => {
    const { data } = await apiClient.get<CalendarResponse>("/calendar", { params });
    return data;
  },
  create: async (payload: Record<string, unknown>) => {
    const { data } = await apiClient.post("/calendar", payload);
    return data;
  },
  update: async (id: number, payload: Record<string, unknown>) => {
    const { data } = await apiClient.put(`/calendar/${id}`, payload);
    return data;
  },
  remove: async (id: number) => {
    const { data } = await apiClient.delete<{ message: string }>(`/calendar/${id}`);
    return data;
  }
};

export const dashboardApi = {
  get: async () => {
    const { data } = await apiClient.get<DashboardResponse>("/dashboard");
    return data;
  }
};

export const assistantApi = {
  askReservationAssistant: async (message: string) => {
    const { data } = await apiClient.post<ReservationAssistantResponse>(
      "/ai/reservation-assistant",
      { message }
    );
    return data;
  },
  confirmPendingAction: async (actionId: string, confirmation?: string) => {
    const { data } = await apiClient.post<ReservationAssistantResponse>(
      `/ai/reservation-assistant/actions/${actionId}/confirm`,
      {
        confirmation
      }
    );
    return data;
  },
  cancelPendingAction: async (actionId: string) => {
    const { data } = await apiClient.post<ReservationAssistantResponse>(
      `/ai/reservation-assistant/actions/${actionId}/cancel`
    );
    return data;
  }
};

export const notificationApi = {
  list: async (params?: { unreadOnly?: boolean; limit?: number }) => {
    const { data } = await apiClient.get<NotificationListResponse>("/notifications", { params });
    return data;
  },
  markAsRead: async (id: number) => {
    const { data } = await apiClient.patch<NotificationRecord>(`/notifications/${id}/read`);
    return data;
  },
  markAllAsRead: async () => {
    const { data } = await apiClient.post<{ updatedCount: number }>(
      "/notifications/mark-all-read"
    );
    return data;
  }
};
