import { Outlet } from "react-router-dom";

export const AuthLayout = () => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(73,111,182,0.16),_transparent_38%),linear-gradient(135deg,_#f8fafc,_#eef3fb)]">
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:gap-10 lg:px-8 lg:py-8">
      <div className="flex items-center justify-center py-10 lg:py-20">
        <div className="max-w-xl">
          <div className="flex items-center gap-4">
            <img
              src="/comport-logo.png"
              alt="ComPort logo"
              className="h-14 w-14 rounded-2xl border border-white/80 bg-white object-cover p-1 shadow-soft"
            />
            <div className="min-w-0">
              <p className="font-display text-2xl font-bold text-slate-900">ComPort</p>
              <p className="text-sm text-slate-500">Computer laboratory reservation platform</p>
            </div>
          </div>
          <span className="mt-6 inline-flex rounded-full bg-brand-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
            ComPort Platform
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
            Reserve computer laboratories with a clearer, more reliable ComPort workflow.
          </h1>
          <p className="mt-5 text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            A polished reservation experience for students, administrators, and laboratory staff.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:mt-10">
            <div className="rounded-xl border border-white/70 bg-white/75 p-5 shadow-soft backdrop-blur">
              <h3 className="font-semibold text-slate-900">Role-based access</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Separate dashboards and workflows for admin, students, and laboratory staff.
              </p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/75 p-5 shadow-soft backdrop-blur">
              <h3 className="font-semibold text-slate-900">Conflict prevention</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
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
