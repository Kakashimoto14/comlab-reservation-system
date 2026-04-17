import clsx from "clsx";
import { LogOut, MonitorCog } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useRoleRoutes } from "../../hooks/useRoleRoutes";
import { useAuth } from "../../store/AuthContext";
import { APP_NAME } from "../../utils/constants";
import { Button } from "../ui/Button";

export const Sidebar = () => {
  const links = useRoleRoutes();
  const { logout, user } = useAuth();

  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-slate-950 px-5 py-6 text-slate-100">
      <div className="mb-8 flex items-center gap-3">
        <div className="rounded-2xl bg-brand-600 p-3">
          <MonitorCog className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display text-sm font-semibold text-brand-100">
            ComLab Portal
          </p>
          <p className="text-xs text-slate-400">{APP_NAME}</p>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <p className="text-sm font-semibold text-white">
          {user?.firstName} {user?.lastName}
        </p>
        <p className="mt-1 text-xs uppercase tracking-[0.2em] text-brand-200">
          {user?.role.replace("_", " ")}
        </p>
      </div>

      <nav className="flex-1 space-y-2">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-brand-700 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              )
            }
          >
            <link.icon className="h-4 w-4" />
            {link.label}
          </NavLink>
        ))}
      </nav>

      <Button variant="secondary" className="mt-6 justify-start" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" />
        Logout
      </Button>
    </aside>
  );
};
