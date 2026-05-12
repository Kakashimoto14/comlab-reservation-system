import { ArrowRight, Building2, CalendarRange, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export const LandingPage = () => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(73,111,182,0.18),_transparent_30%),linear-gradient(180deg,_#f8fafc,_#eef3fb)] px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 rounded-xl border border-white/70 bg-white/85 px-5 py-4 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <img
            src="/comport-logo.png"
            alt="ComPort logo"
            className="h-12 w-12 rounded-2xl border border-white/80 bg-white object-cover p-1 shadow-soft"
          />
          <div className="min-w-0">
            <p className="font-display text-xl font-bold text-slate-900">ComPort Reservation System</p>
            <p className="mt-1 text-sm leading-5 text-slate-500">
              Academic reservation platform for modern computer laboratory operations
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/login">
            <Button variant="outline">Login</Button>
          </Link>
          <Link to="/register">
            <Button>Register as Student</Button>
          </Link>
        </div>
      </header>

      <section className="grid gap-10 py-12 sm:py-14 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:py-16">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-brand-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
            ComPort Campus Workflow
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-slate-900 sm:text-4xl lg:text-5xl">
            A polished way to manage computer laboratory reservations, approvals, assistance, and reports.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Built for real academic operations with role-based dashboards, schedule-aware reservation requests, assistant support, conflict prevention, and accountable workflows.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/register">
              <Button>
                Start Student Registration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline">Login to Portal</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-gradient-to-br from-brand-800 to-brand-600 text-white">
            <Building2 className="h-8 w-8" />
            <h3 className="mt-6 text-xl font-semibold leading-tight">Laboratory Management</h3>
            <p className="mt-3 text-sm leading-6 text-brand-100">
              Manage rooms, capacities, devices, statuses, and ready-to-deploy operational details.
            </p>
          </Card>
          <Card className="bg-white">
            <CalendarRange className="h-8 w-8 text-accent" />
            <h3 className="mt-6 text-xl font-semibold leading-tight text-slate-900">Reservation Workflow</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Students request, staff review, and the system prevents invalid scheduling conflicts.
            </p>
          </Card>
          <Card className="bg-white sm:col-span-2">
            <ShieldCheck className="h-8 w-8 text-success" />
            <h3 className="mt-6 text-xl font-semibold leading-tight text-slate-900">Role-Based Security</h3>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              JWT-authenticated accounts for admins, students, and laboratory staff with clean dashboards and protected routes.
            </p>
          </Card>
        </div>
      </section>
    </div>
  </div>
);
