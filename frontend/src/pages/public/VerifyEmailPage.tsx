import type { AxiosError } from "axios";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import { authApi } from "../../api/services";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";

type VerificationState = "loading" | "success" | "error";
type VerificationApiError = {
  message?: string;
  errors?: Record<string, string[]>;
};

const inFlightVerificationRequests = new Map<string, Promise<{ message: string }>>();

const getVerificationRequest = (token: string) => {
  const cachedRequest = inFlightVerificationRequests.get(token);

  if (cachedRequest) {
    return cachedRequest;
  }

  const nextRequest = authApi
    .verifyEmail({ token })
    .finally(() => inFlightVerificationRequests.delete(token));

  inFlightVerificationRequests.set(token, nextRequest);
  return nextRequest;
};

const getVerificationErrorMessage = (error: unknown) => {
  const axiosError = error as AxiosError<VerificationApiError>;

  return (
    axiosError.response?.data?.errors?.token?.[0] ??
    axiosError.response?.data?.message ??
    "Unable to verify this email link right now. Please try again or request a new verification email."
  );
};

export const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [state, setState] = useState<VerificationState>(token ? "loading" : "error");
  const [message, setMessage] = useState<string>(
    token
      ? "Verifying your email address..."
      : "The verification token is missing. Request a new verification email to continue."
  );
  const successMessage = "You can now log in to your ComPort account.";

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("The verification token is missing. Request a new verification email to continue.");
      return;
    }

    let isActive = true;

    const verifyEmail = async () => {
      setState("loading");
      setMessage("Verifying your email address...");

      try {
        const response = await getVerificationRequest(token);

        if (!isActive) {
          return;
        }

        setState("success");
        setMessage(response.message || successMessage);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setState("error");
        setMessage(getVerificationErrorMessage(error));
      }
    };

    void verifyEmail();

    return () => {
      isActive = false;
    };
  }, [token]);

  if (!token) {
    return (
      <Card className="w-full max-w-md">
        <EmptyState title="Verification failed" description={message} />
        <div className="mt-5">
          <Link to="/login" className="block">
            <Button fullWidth>Back to Login</Button>
          </Link>
        </div>
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
                ? "Email verified successfully"
                : "Verification failed"}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {state === "success" ? successMessage : message}
          </p>
          {state === "success" && message !== successMessage ? (
            <p className="mt-2 text-sm leading-6 text-slate-600">{message}</p>
          ) : null}
        </div>

        {state === "loading" ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Verifying your email address...
          </div>
        ) : null}

        {state === "success" ? (
          <Link
            to="/login"
            state={{
              authMessage: "Email verified successfully. You can now log in to your ComPort account."
            }}
            className="block"
          >
            <Button fullWidth>Go to Login</Button>
          </Link>
        ) : null}

        {state === "error" ? (
          <Link to="/login" className="block">
            <Button fullWidth>Back to Login</Button>
          </Link>
        ) : null}
      </div>
    </Card>
  );
};
