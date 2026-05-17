import { Navigate, Outlet, useLocation } from "react-router-dom";

import { StartupSplash } from "./StartupSplash";
import { useAuth } from "../../store/AuthContext";
import type { UserRole } from "../../types/api";

export const ProtectedRoute = ({ allowedRoles }: { allowedRoles?: UserRole[] }) => {
  const { initialized, user } = useAuth();
  const location = useLocation();

  if (!initialized) {
    return <StartupSplash />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/forbidden" state={{ from: location }} replace />;
  }

  return <Outlet />;
};
