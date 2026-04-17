import { Menu } from "lucide-react";
import { useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { Button } from "../components/ui/Button";

export const DashboardLayout = () => {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="h-full w-72" onClick={(event) => event.stopPropagation()}>
            <Sidebar />
          </div>
        </div>
      ) : null}

      <main className="px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
        <div className="mb-4 flex justify-end lg:hidden">
          <Button variant="secondary" onClick={() => setOpen(true)}>
            <Menu className="mr-2 h-4 w-4" />
            Menu
          </Button>
        </div>
        <Topbar />
        <Outlet />
      </main>
    </div>
  );
};
