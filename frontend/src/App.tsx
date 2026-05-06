import { Suspense, lazy } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { AuthProvider, useAuth } from "./store/AuthContext";

const LoginPage = lazy(() =>
  import("./pages/public/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const RegisterPage = lazy(() =>
  import("./pages/public/RegisterPage").then((module) => ({ default: module.RegisterPage }))
);
const LandingPage = lazy(() =>
  import("./pages/public/LandingPage").then((module) => ({ default: module.LandingPage }))
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/public/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage
  }))
);
const ResetPasswordPage = lazy(() =>
  import("./pages/public/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage }))
);
const ForbiddenPage = lazy(() =>
  import("./pages/public/ForbiddenPage").then((module) => ({ default: module.ForbiddenPage }))
);
const StudentDashboardPage = lazy(() =>
  import("./pages/student/StudentDashboardPage").then((module) => ({
    default: module.StudentDashboardPage
  }))
);
const LaboratoriesPage = lazy(() =>
  import("./pages/student/LaboratoriesPage").then((module) => ({ default: module.LaboratoriesPage }))
);
const LaboratoryDetailsPage = lazy(() =>
  import("./pages/student/LaboratoryDetailsPage").then((module) => ({
    default: module.LaboratoryDetailsPage
  }))
);
const ReserveLaboratoryPage = lazy(() =>
  import("./pages/student/ReserveLaboratoryPage").then((module) => ({
    default: module.ReserveLaboratoryPage
  }))
);
const MyReservationsPage = lazy(() =>
  import("./pages/student/MyReservationsPage").then((module) => ({
    default: module.MyReservationsPage
  }))
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage").then((module) => ({ default: module.ProfilePage }))
);
const StaffDashboardPage = lazy(() =>
  import("./pages/staff/StaffDashboardPage").then((module) => ({
    default: module.StaffDashboardPage
  }))
);
const UserManagementPage = lazy(() =>
  import("./pages/admin/UserManagementPage").then((module) => ({ default: module.UserManagementPage }))
);
const LaboratoryStaffAssignmentPage = lazy(() =>
  import("./pages/admin/LaboratoryStaffAssignmentPage").then((module) => ({
    default: module.LaboratoryStaffAssignmentPage
  }))
);
const ManagementCalendarPage = lazy(() =>
  import("./pages/admin/ManagementCalendarPage").then((module) => ({
    default: module.ManagementCalendarPage
  }))
);
const LaboratoryManagementPage = lazy(() =>
  import("./pages/staff/LaboratoryManagementPage").then((module) => ({
    default: module.LaboratoryManagementPage
  }))
);
const ScheduleManagementPage = lazy(() =>
  import("./pages/staff/ScheduleManagementPage").then((module) => ({
    default: module.ScheduleManagementPage
  }))
);
const ReservationManagementPage = lazy(() =>
  import("./pages/staff/ReservationManagementPage").then((module) => ({
    default: module.ReservationManagementPage
  }))
);
const ReportsPage = lazy(() =>
  import("./pages/staff/ReportsPage").then((module) => ({ default: module.ReportsPage }))
);
const NotFoundPage = lazy(() =>
  import("./pages/public/NotFoundPage").then((module) => ({ default: module.NotFoundPage }))
);

const queryClient = new QueryClient();

const HomeRedirect = () => {
  const { user } = useAuth();

  if (!user) {
    return <LandingPage />;
  }

  return <Navigate to={user.role === "STUDENT" ? "/student/dashboard" : "/dashboard"} replace />;
};

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrowserRouter>
        <Suspense
          fallback={
            <div className="flex min-h-screen items-center justify-center bg-slate-50">
              <div className="rounded-3xl bg-white px-6 py-4 shadow-soft">Loading page...</div>
            </div>
          }
        >
          <Routes>
            <Route path="/" element={<HomeRedirect />} />
            <Route element={<AuthLayout />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
            </Route>
            <Route path="/forbidden" element={<ForbiddenPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/laboratory-guide" element={<LaboratoriesPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["STUDENT"]} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/student/dashboard" element={<StudentDashboardPage />} />
                <Route path="/student/laboratories" element={<LaboratoriesPage />} />
                <Route path="/student/laboratories/:id" element={<LaboratoryDetailsPage />} />
                <Route
                  path="/student/laboratories/:id/reserve"
                  element={<ReserveLaboratoryPage />}
                />
                <Route path="/student/reservations" element={<MyReservationsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["ADMIN", "LABORATORY_STAFF"]} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/dashboard" element={<StaffDashboardPage />} />
                <Route path="/management/laboratories" element={<LaboratoryManagementPage />} />
                <Route path="/management/schedules" element={<ScheduleManagementPage />} />
                <Route
                  path="/management/reservations"
                  element={<ReservationManagementPage />}
                />
                <Route path="/management/reports" element={<ReportsPage />} />
              </Route>
            </Route>

            <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
              <Route element={<DashboardLayout />}>
                <Route path="/management/users" element={<UserManagementPage />} />
                <Route
                  path="/management/laboratories/assign-staff"
                  element={<LaboratoryStaffAssignmentPage />}
                />
                <Route path="/management/calendar" element={<ManagementCalendarPage />} />
              </Route>
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  </QueryClientProvider>
);
