import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("shows the main call-to-action buttons", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Start Student Registration")).toBeInTheDocument();
    expect(screen.getByText("Use Demo Accounts")).toBeInTheDocument();
  });
});
