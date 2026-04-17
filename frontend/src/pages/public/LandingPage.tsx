import { ArrowRight, Building2, CalendarRange, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";

export const LandingPage = () => (
  <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(73,111,182,0.18),_transparent_30%),linear-gradient(180deg,_#f8fafc,_#eef3fb)] px-4 py-10">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 rounded-[32px] border border-white/70 bg-white/80 px-6 py-5 shadow-soft backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-xl font-bold text-slate-900">ComLab Reservation System</p>
          <p className="text-sm text-slate-500">Academic reservation platform for BSIT laboratory operations</p>
        </div>
        <div className="flex gap-3">
          <Link to="/login">
            <Button variant="outline">Login</Button>
          </Link>
          <Link to="/register">
            <Button>Register as Student</Button>
          </Link>
        </div>
      </header>

      <section className="grid gap-10 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <span className="rounded-full bg-brand-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-brand-700">
            Production-style BSIT project
          </span>
          <h1 className="mt-6 font-display text-5xl font-bold leading-tight text-slate-900">
            A polished way to manage computer laboratory reservations, approvals, and reports.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Built for realistic college demonstrations with role-based dashboards, schedule-aware reservation requests, conflict prevention, and ready-to-use demo data.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/register">
              <Button>
                Start Student Registration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button variant="outline">Use Demo Accounts</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="bg-gradient-to-br from-brand-800 to-brand-600 text-white">
            <Building2 className="h-8 w-8" />
            <h3 className="mt-6 text-xl font-semibold">Laboratory Management</h3>
            <p className="mt-3 text-sm text-brand-100">
              Manage rooms, capacities, devices, statuses, and demonstration-ready details.
            </p>
          </Card>
          <Card className="bg-white">
            <CalendarRange className="h-8 w-8 text-accent" />
            <h3 className="mt-6 text-xl font-semibold text-slate-900">Reservation Workflow</h3>
            <p className="mt-3 text-sm text-slate-500">
              Students request, staff review, and the system prevents invalid scheduling conflicts.
            </p>
          </Card>
          <Card className="bg-white sm:col-span-2">
            <ShieldCheck className="h-8 w-8 text-success" />
            <h3 className="mt-6 text-xl font-semibold text-slate-900">Role-Based Security</h3>
            <p className="mt-3 text-sm text-slate-500">
              JWT-authenticated accounts for admins, students, and laboratory staff with clean dashboards and protected routes.
            </p>
          </Card>
        </div>
      </section>
    </div>
  </div>
);
