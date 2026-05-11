import clsx from "clsx";
import { LogOut, MonitorCog, X } from "lucide-react";
import { NavLink } from "react-router-dom";

import { useRoleRoutes } from "../../hooks/useRoleRoutes";
import { useAuth } from "../../store/AuthContext";
import { APP_NAME, roleLabels } from "../../utils/constants";
import { Button } from "../ui/Button";

type SidebarProps = {
  onClose?: () => void;
  onNavigate?: () => void;
};

const utilityLabels = new Set(["Profile", "Laboratory Guide"]);

export const Sidebar = ({ onClose, onNavigate }: SidebarProps) => {
  const links = useRoleRoutes();
  const { logout, user } = useAuth();
  const primaryLinks = links.filter((link) => !utilityLabels.has(link.label));
  const utilityLinks = links.filter((link) => utilityLabels.has(link.label));

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-slate-950 text-slate-100">
      <div className="shrink-0 px-5 pb-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-brand-600 p-3">
            <MonitorCog className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm font-semibold text-brand-100">
              ComLab Portal
            </p>
            <p className="truncate text-xs text-slate-400">{APP_NAME}</p>
          </div>
          {onClose ? (
            <button
              type="button"
              aria-label="Close navigation menu"
              className="ml-auto rounded-2xl p-2 text-slate-300 transition hover:bg-slate-900 hover:text-white lg:hidden"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 px-5 pb-4">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="truncate text-sm font-semibold text-white">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="mt-1 truncate text-xs uppercase tracking-[0.2em] text-brand-200">
            {user ? roleLabels[user.role] : "User"}
          </p>
        </div>
      </div>

      <nav className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-2">
        {primaryLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                isActive
                  ? "bg-brand-700 text-white"
                  : "text-slate-300 hover:bg-slate-900 hover:text-white"
              )
            }
          >
            <link.icon className="h-4 w-4 shrink-0" />
            <span className="truncate">{link.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950 px-5 pb-5 pt-4">
        {utilityLinks.length ? (
          <nav className="mb-4 space-y-2">
            {utilityLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onNavigate}
                className={({ isActive }) =>
                  clsx(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                    isActive
                      ? "bg-brand-700 text-white"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  )
                }
              >
                <link.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{link.label}</span>
              </NavLink>
            ))}
          </nav>
        ) : null}
        <Button
          variant="secondary"
          className="w-full justify-start"
          onClick={() => {
            onNavigate?.();
            logout();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </aside>
  );
};
