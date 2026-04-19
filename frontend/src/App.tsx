import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./components/layout/ProtectedRoute";
import { DashboardLayout } from "./layouts/DashboardLayout";
import { AuthLayout } from "./layouts/AuthLayout";
import { AuthProvider, useAuth } from "./store/AuthContext";

import { LoginPage } from "./pages/public/LoginPage";
import { RegisterPage } from "./pages/public/RegisterPage";
import { LandingPage } from "./pages/public/LandingPage";
import { ForgotPasswordPage } from "./pages/public/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/public/ResetPasswordPage";
import { ForbiddenPage } from "./pages/public/ForbiddenPage";
import { StudentDashboardPage } from "./pages/student/StudentDashboardPage";
import { LaboratoriesPage } from "./pages/student/LaboratoriesPage";
import { LaboratoryDetailsPage } from "./pages/student/LaboratoryDetailsPage";
import { ReserveLaboratoryPage } from "./pages/student/ReserveLaboratoryPage";
import { MyReservationsPage } from "./pages/student/MyReservationsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { StaffDashboardPage } from "./pages/staff/StaffDashboardPage";
import { UserManagementPage } from "./pages/admin/UserManagementPage";
import { LaboratoryManagementPage } from "./pages/staff/LaboratoryManagementPage";
import { ScheduleManagementPage } from "./pages/staff/ScheduleManagementPage";
import { ReservationManagementPage } from "./pages/staff/ReservationManagementPage";
import { ReportsPage } from "./pages/staff/ReportsPage";
import { NotFoundPage } from "./pages/public/NotFoundPage";

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
              <Route path="/management/reservations" element={<ReservationManagementPage />} />
              <Route path="/management/reports" element={<ReportsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={["ADMIN"]} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/management/users" element={<UserManagementPage />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" />
    </AuthProvider>
  </QueryClientProvider>
);
