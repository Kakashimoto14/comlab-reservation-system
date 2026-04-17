import { render, screen } from "@testing-library/react";

import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the provided status label", () => {
    render(<StatusBadge status="APPROVED" />);

    expect(screen.getByText("APPROVED")).toBeInTheDocument();
  });
});
