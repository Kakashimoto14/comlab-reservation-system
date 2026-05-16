import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { authApi } from "../../api/services";
import { VerifyEmailPage } from "./VerifyEmailPage";

vi.mock("../../api/services", () => ({
  authApi: {
    verifyEmail: vi.fn()
  }
}));

const mockedAuthApi = vi.mocked(authApi);

const renderPage = (path: string) =>
  render(
    <React.StrictMode>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<div>Login page</div>} />
        </Routes>
      </MemoryRouter>
    </React.StrictMode>
  );

describe("VerifyEmailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("posts the token exactly once in StrictMode and shows success state", async () => {
    mockedAuthApi.verifyEmail.mockResolvedValue({
      message: "Email verified successfully. You can now log in."
    });

    renderPage("/verify-email?token=12345678901234567890-valid-token");

    expect(screen.getByText("Checking your verification link")).toBeInTheDocument();

    await waitFor(() =>
      expect(mockedAuthApi.verifyEmail).toHaveBeenCalledWith({
        token: "12345678901234567890-valid-token"
      })
    );
    expect(mockedAuthApi.verifyEmail).toHaveBeenCalledTimes(1);

    expect(await screen.findByText("Email verified successfully")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Go to Login" })).toBeInTheDocument();
  });

  it("shows a missing-token state without sending a request", () => {
    renderPage("/verify-email");

    expect(screen.getByText("Verification failed")).toBeInTheDocument();
    expect(
      screen.getByText("The verification token is missing. Request a new verification email to continue.")
    ).toBeInTheDocument();
    expect(mockedAuthApi.verifyEmail).not.toHaveBeenCalled();
  });

  it("shows backend verification errors instead of staying in loading state", async () => {
    mockedAuthApi.verifyEmail.mockRejectedValue({
      response: {
        data: {
          message: "This email verification link is invalid or has already expired."
        }
      }
    });

    renderPage("/verify-email?token=12345678901234567890-invalid-token");

    expect(await screen.findByText("Verification failed")).toBeInTheDocument();
    expect(
      screen.getByText("This email verification link is invalid or has already expired.")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Login" })).toBeInTheDocument();
  });
});
