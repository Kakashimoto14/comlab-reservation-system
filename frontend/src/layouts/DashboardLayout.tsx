import { Menu } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "../components/layout/Sidebar";
import { Topbar } from "../components/layout/Topbar";
import { Button } from "../components/ui/Button";

export const DashboardLayout = () => {
  const [open, setOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    requestAnimationFrame(() => {
      const firstFocusableElement = drawerRef.current?.querySelector<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );

      firstFocusableElement?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== "Tab" || !drawerRef.current) {
        return;
      }

      const focusableElements = Array.from(
        drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      );

      if (!focusableElements.length) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const closeDrawer = () => {
    setOpen(false);
    menuButtonRef.current?.focus();
  };

  return (
    <div className="grid h-dvh min-h-0 overflow-hidden bg-slate-100 text-slate-900 lg:grid-cols-[280px_1fr]">
      <div className="hidden min-h-0 lg:block">
        <Sidebar />
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm lg:hidden"
          onClick={closeDrawer}
        >
          <div
            ref={drawerRef}
            className="h-full w-[min(20rem,calc(100vw-2rem))] shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            onClick={(event) => event.stopPropagation()}
          >
            <Sidebar onClose={closeDrawer} onNavigate={closeDrawer} />
          </div>
        </div>
      ) : null}

      <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
        <div className="shrink-0 px-4 pt-4 sm:px-6 lg:hidden">
          <Button ref={menuButtonRef} variant="secondary" onClick={() => setOpen(true)}>
            <Menu className="mr-2 h-4 w-4" />
            Menu
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <Topbar />
          <Outlet />
        </div>
      </main>
    </div>
  );
};
