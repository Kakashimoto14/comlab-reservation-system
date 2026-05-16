import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the intro on first visit and keeps the main call-to-action buttons", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Initializing ComPort...")).toBeInTheDocument();
    expect(screen.getByText("Start Student Registration")).toBeInTheDocument();
    expect(screen.getByText("Login to Portal")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1600);
    });

    expect(screen.queryByText("Initializing ComPort...")).not.toBeInTheDocument();
    expect(sessionStorage.getItem("comportIntroShown")).toBe("true");
  });

  it("skips the intro after it has already been shown in the same session", () => {
    sessionStorage.setItem("comportIntroShown", "true");

    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.queryByText("Initializing ComPort...")).not.toBeInTheDocument();
    expect(screen.getByText("Login to Portal")).toBeInTheDocument();
  });
});
