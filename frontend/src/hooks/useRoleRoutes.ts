import { useMemo } from "react";
import {
  BookOpen,
  Building2,
  CalendarClock,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  UserCog,
  UserRound
} from "lucide-react";

import { useAuth } from "../store/AuthContext";
import { isAdmin, isManagementRole } from "../utils/rbac";

export const useRoleRoutes = () => {
  const { user } = useAuth();

  return useMemo(() => {
    if (!user) {
      return [];
    }

    if (user.role === "STUDENT") {
      return [
        { label: "Dashboard", to: "/student/dashboard", icon: LayoutDashboard },
        { label: "Laboratories", to: "/student/laboratories", icon: Building2 },
        { label: "My Reservations", to: "/student/reservations", icon: ClipboardList },
        { label: "Profile", to: "/profile", icon: UserRound }
      ];
    }

    const items = [
      { label: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
      { label: "Laboratories", to: "/management/laboratories", icon: Building2 },
      { label: "Schedules", to: "/management/schedules", icon: CalendarClock },
      { label: "Reservations", to: "/management/reservations", icon: ClipboardList },
      { label: "Reports", to: "/management/reports", icon: LineChart },
      { label: "Profile", to: "/profile", icon: UserRound }
    ];

    if (isAdmin(user.role)) {
      items.splice(1, 0, {
        label: "Users",
        to: "/management/users",
        icon: UserCog
      });
    }

    if (isManagementRole(user.role)) {
      items.push({
        label: "Laboratory Guide",
        to: "/student/laboratories",
        icon: BookOpen
      });
    }

    return items;
  }, [user]);
};
