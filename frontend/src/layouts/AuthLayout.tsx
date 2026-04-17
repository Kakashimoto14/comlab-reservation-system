import { Outlet } from "react-router-dom";

export const AuthLayout = () => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(73,111,182,0.16),_transparent_38%),linear-gradient(135deg,_#f8fafc,_#eef3fb)]">
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-8 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:gap-10 lg:px-8">
      <div className="flex items-center justify-center py-12 lg:py-20">
        <div className="max-w-xl">
          <span className="rounded-full bg-brand-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
            BSIT Capstone Demo Project
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-tight text-slate-900">
            Reserve college computer laboratories with clarity, control, and accountability.
          </h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">
            A polished full-stack reservation platform for students, administrators, and laboratory staff.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-soft">
              <h3 className="font-semibold text-slate-900">Role-based access</h3>
              <p className="mt-2 text-sm text-slate-500">
                Separate dashboards and workflows for admin, students, and laboratory staff.
              </p>
            </div>
            <div className="rounded-3xl border border-white/60 bg-white/70 p-5 shadow-soft">
              <h3 className="font-semibold text-slate-900">Conflict prevention</h3>
              <p className="mt-2 text-sm text-slate-500">
                Schedule-aware reservations with overlap detection and approval controls.
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-center">
        <Outlet />
      </div>
    </div>
  </div>
);
