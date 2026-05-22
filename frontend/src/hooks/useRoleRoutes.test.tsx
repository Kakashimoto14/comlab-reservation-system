import { renderHook } from "@testing-library/react";

import { useRoleRoutes } from "./useRoleRoutes";
import type { User, UserRole } from "../types/api";

let mockedUser: User | null = null;

vi.mock("../store/AuthContext", () => ({
  useAuth: () => ({
    user: mockedUser
  })
}));

const buildUser = (role: UserRole): User => ({
  id: 1,
  firstName: "Test",
  lastName: "User",
  email: `${role.toLowerCase()}@comlab.edu`,
  role,
  status: "ACTIVE",
  createdAt: "2026-05-22T00:00:00.000Z",
  updatedAt: "2026-05-22T00:00:00.000Z"
});

describe("useRoleRoutes", () => {
  afterEach(() => {
    mockedUser = null;
  });

  it.each<UserRole>(["ADMIN", "LABORATORY_STAFF", "STUDENT"])(
    "shows ComPort Assistant for %s",
    (role) => {
      mockedUser = buildUser(role);

      const { result } = renderHook(() => useRoleRoutes());

      expect(result.current).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            label: "ComPort Assistant",
            to: "/assistant"
          })
        ])
      );
    }
  );

  it("keeps admin-only management links away from laboratory staff", () => {
    mockedUser = buildUser("LABORATORY_STAFF");

    const { result } = renderHook(() => useRoleRoutes());
    const labels = result.current.map((route) => route.label);

    expect(labels).not.toContain("Users");
    expect(labels).not.toContain("Assign Staff");
    expect(labels).not.toContain("Calendar");
  });
});
