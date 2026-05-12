import type { AxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { authApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

type VerificationState = "loading" | "success" | "error";

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const attemptedTokenRef = useRef<string | null>(null);
  const [state, setState] = useState<VerificationState>(token ? "loading" : "error");
  const [message, setMessage] = useState<string>(
    token
      ? "Verifying your email address..."
      : "The verification token is missing. Request a new verification email to continue."
  );

  useEffect(() => {
    if (!token || attemptedTokenRef.current === token) {
      return;
    }

    attemptedTokenRef.current = token;
    let active = true;

    const verifyEmail = async () => {
      try {
        const response = await authApi.verifyEmail({ token });

        if (!active) {
          return;
        }

        setState("success");
        setMessage(response.message);
      } catch (error) {
        if (!active) {
          return;
        }

        const nextMessage =
          (error as AxiosError<{ message?: string }>).response?.data?.message ??
          "Unable to verify this email link.";
        setState("error");
        setMessage(nextMessage);
      }
    };

    void verifyEmail();

    return () => {
      active = false;
    };
  }, [token]);

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <EmptyState title="Invalid verification link" description={message} />
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-700">
            Email Verification
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">
            {state === "loading"
              ? "Checking your verification link"
              : state === "success"
                ? "Email verified"
                : "Verification failed"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{message}</p>
        </div>

        {state === "loading" ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Please wait while we confirm your account.
          </div>
        ) : null}

        {state === "success" ? (
          <Link
            to="/login"
            state={{
              authMessage: message
            }}
            className="block"
          >
            <Button fullWidth>Continue to Login</Button>
          </Link>
        ) : null}

        {state === "error" ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/login" className="block flex-1">
              <Button fullWidth>Back to Login</Button>
            </Link>
            <Link to="/register" className="block flex-1">
              <Button variant="secondary" fullWidth>
                Register Again
              </Button>
            </Link>
          </div>
        ) : null}
      </div>
    </Card>
  );
};
