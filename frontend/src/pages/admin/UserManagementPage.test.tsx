import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import toast from "react-hot-toast";

import { userApi } from "../../api/services";
import { UserManagementPage } from "./UserManagementPage";

vi.mock("../../api/services", () => ({
  userApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn()
  }
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

const mockedUserApi = vi.mocked(userApi);
const mockedToast = vi.mocked(toast);

const renderPage = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      }
    }
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <UserManagementPage />
    </QueryClientProvider>
  );
};

const fillBaseUserFields = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.type(screen.getByLabelText("First Name"), "Ada");
  await user.type(screen.getByLabelText("Last Name"), "Lovelace");
  await user.type(screen.getByLabelText("Email"), "ada@comlab.edu");
};

describe("UserManagementPage", () => {
  beforeEach(() => {
    mockedUserApi.list.mockResolvedValue([]);
    mockedUserApi.create.mockResolvedValue({} as never);
    mockedUserApi.update.mockResolvedValue({} as never);
    mockedUserApi.updateStatus.mockResolvedValue({} as never);
    vi.clearAllMocks();
  });

  it("creates an admin without student-only fields and disables submit while pending", async () => {
    const user = userEvent.setup();
    let resolveCreate: (() => void) | undefined;
    const createPromise = new Promise<void>((resolve) => {
      resolveCreate = resolve;
    });

    mockedUserApi.create.mockReturnValue(createPromise as Promise<never>);

    renderPage();

    await screen.findByText("No users available");
    await user.click(screen.getByText("Add User"));
    await fillBaseUserFields(user);
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.selectOptions(screen.getByLabelText("Role"), "ADMIN");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await waitFor(() => expect(mockedUserApi.create).toHaveBeenCalledTimes(1));

    const submittedPayload = mockedUserApi.create.mock.calls[0][0];
    expect(submittedPayload).toMatchObject({
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@comlab.edu",
      password: "Password123!",
      role: "ADMIN"
    });
    expect(submittedPayload).not.toHaveProperty("studentNumber");
    expect(submittedPayload).not.toHaveProperty("yearLevel");
    expect(screen.getByRole("button", { name: "Creating..." })).toBeDisabled();

    resolveCreate?.();

    await waitFor(() =>
      expect(mockedToast.success).toHaveBeenCalledWith("User account created.")
    );
  });

  it("creates laboratory staff without student-only fields", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText("No users available");
    await user.click(screen.getByText("Add User"));
    await fillBaseUserFields(user);
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.selectOptions(screen.getByLabelText("Role"), "LABORATORY_STAFF");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await waitFor(() => expect(mockedUserApi.create).toHaveBeenCalledTimes(1));

    expect(mockedUserApi.create.mock.calls[0][0]).toMatchObject({
      role: "LABORATORY_STAFF"
    });
    expect(mockedUserApi.create.mock.calls[0][0]).not.toHaveProperty("studentNumber");
    expect(mockedUserApi.create.mock.calls[0][0]).not.toHaveProperty("yearLevel");
  });

  it("requires student number and year level for student creation and shows a visible error", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText("No users available");
    await user.click(screen.getByText("Add User"));
    await fillBaseUserFields(user);
    await user.type(screen.getByLabelText("Password"), "Password123!");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await waitFor(() => expect(mockedUserApi.create).not.toHaveBeenCalled());

    expect(
      screen.getAllByText("Student number is required for student accounts.")
    ).toHaveLength(2);
    expect(screen.getByText("Year level is required for student accounts.")).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Student number is required for student accounts."
    );
    expect(mockedToast.error).toHaveBeenCalledWith(
      "Student number is required for student accounts."
    );
  });

  it("requires a password when creating a new user", async () => {
    const user = userEvent.setup();

    renderPage();

    await screen.findByText("No users available");
    await user.click(screen.getByText("Add User"));
    await fillBaseUserFields(user);
    await user.selectOptions(screen.getByLabelText("Role"), "ADMIN");
    await user.click(screen.getByRole("button", { name: "Create User" }));

    await waitFor(() => expect(mockedUserApi.create).not.toHaveBeenCalled());

    expect(screen.getAllByText("Password is required for new users.")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent("Password is required for new users.");
    expect(mockedToast.error).toHaveBeenCalledWith("Password is required for new users.");
  });
});
