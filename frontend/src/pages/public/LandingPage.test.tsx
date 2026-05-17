import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("renders the hero call to action and feature cards", () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText("ComPort Reservation System")).toBeInTheDocument();
    expect(screen.getByText("Start Student Registration")).toBeInTheDocument();
    expect(screen.getByText("Login to Portal")).toBeInTheDocument();
    expect(screen.getByText("Laboratory Management")).toBeInTheDocument();
    expect(screen.getByText("Reservation Workflow")).toBeInTheDocument();
    expect(screen.getByText("Role-Based Security")).toBeInTheDocument();
  });
});
