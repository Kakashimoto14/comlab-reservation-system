import { ShieldX } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

import { Card } from "../../components/ui/Card";
import { useAuth } from "../../store/AuthContext";

export const ForbiddenPage = () => {
  const { user } = useAuth();
  const location = useLocation();
  const destination = user?.role === "STUDENT" ? "/student/dashboard" : "/dashboard";
  const requestedPath = location.state?.from?.pathname as string | undefined;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <Card className="w-full max-w-2xl p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-100 text-rose-600">
          <ShieldX className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-rose-500">
          Access Restricted
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-slate-900">
          You do not have permission to open this page.
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          {requestedPath
            ? `The route ${requestedPath} is not available for your account role.`
            : "This page is only available to a different account role in the ComLab system."}
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={destination}
            className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Go to my dashboard
          </Link>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
          >
            Return home
          </Link>
        </div>
      </Card>
    </div>
  );
};
