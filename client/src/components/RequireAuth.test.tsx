import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
vi.mock("wouter", async () => {
  const actual = await vi.importActual<typeof import("wouter")>("wouter");
  return {
    ...actual,
    useLocation: () => ["/profile", navigateMock],
  };
});

const useAuthMock = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => useAuthMock(),
}));

import RequireAuth from "./RequireAuth";

describe("RequireAuth", () => {
  it("renders a spinner while loading", () => {
    useAuthMock.mockReturnValue({ user: null, loading: true, isAuthenticated: false });
    render(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("redirects to /login when unauthenticated", () => {
    navigateMock.mockClear();
    useAuthMock.mockReturnValue({ user: null, loading: false, isAuthenticated: false });
    render(<RequireAuth><div>secret</div></RequireAuth>);
    expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    useAuthMock.mockReturnValue({
      user: { uid: "u1" },
      loading: false,
      isAuthenticated: true,
    });
    render(<RequireAuth><div>secret</div></RequireAuth>);
    expect(screen.getByText("secret")).toBeInTheDocument();
  });
});
