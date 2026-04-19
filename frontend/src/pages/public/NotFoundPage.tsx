import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { Card } from "../../components/ui/Card";
import { useAuth } from "../../store/AuthContext";

export const NotFoundPage = () => {
  const { user } = useAuth();
  const destination = user
    ? user.role === "STUDENT"
      ? "/student/dashboard"
      : "/dashboard"
    : "/";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <Card className="w-full max-w-2xl p-8 text-center sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-100 text-brand-700">
          <Compass className="h-8 w-8" />
        </div>
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.3em] text-brand-500">
          Page Not Found
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-slate-900">
          We could not find the page you were looking for.
        </h1>
        <p className="mt-4 text-base leading-8 text-slate-600">
          The page may have been moved, renamed, or is not part of the current ComLab
          portal workflow.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to={destination}
            className="inline-flex items-center justify-center rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
          >
            Back to dashboard
          </Link>
          {!user ? (
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              Open login
            </Link>
          ) : null}
        </div>
      </Card>
    </div>
  );
};
