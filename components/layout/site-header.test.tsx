import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname, useRouter } from "next/navigation";
import { CurrentUserProvider } from "@/lib/current-user-context";
import { createClient } from "@/lib/supabase/client";
import { SiteHeader } from "./site-header";

const push = vi.fn();
const refreshRouter = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
  useRouter: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));

const signOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const usePathnameMock = vi.mocked(usePathname);
const useRouterMock = vi.mocked(useRouter);
const createClientMock = vi.mocked(createClient);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

const SUZUKI_MANAGER = { ...YAMADA, sales_person_id: 5, name: "鈴木一郎", is_manager: true };

function mockFetch({
  salesPersons = [],
  me,
  meStatus = 200,
}: {
  salesPersons?: unknown[];
  me?: unknown;
  meStatus?: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          status: meStatus,
          ok: meStatus < 400,
          json: () =>
            Promise.resolve(
              meStatus < 400
                ? me
                : { error: { code: "UNAUTHENTICATED", message: "ログインしていません" } },
            ),
        });
      }
      if (url.includes("/api/sales-persons")) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(salesPersons),
        });
      }
      return Promise.reject(new Error(`unexpected fetch call: ${url}`));
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
  push.mockReset();
  refreshRouter.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  usePathnameMock.mockReturnValue("/reports");
  useRouterMock.mockReturnValue({
    push,
    refresh: refreshRouter,
  } as unknown as ReturnType<typeof useRouter>);
  createClientMock.mockReset();
  createClientMock.mockReturnValue({
    auth: { signOut },
  } as unknown as ReturnType<typeof createClient>);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderHeader() {
  return render(
    <CurrentUserProvider>
      <SiteHeader />
    </CurrentUserProvider>,
  );
}

describe("SiteHeader", () => {
  it("links the title/logo to the top page", () => {
    mockFetch({ salesPersons: [YAMADA], me: YAMADA });
    renderHeader();

    expect(screen.getByRole("link", { name: "営業日報システム" })).toHaveAttribute("href", "/");
  });

  it("renders nothing on the login page", () => {
    usePathnameMock.mockReturnValue("/login");
    mockFetch({ salesPersons: [YAMADA], me: YAMADA });
    const { container } = renderHeader();

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the three global nav links pointing at the correct routes", () => {
    mockFetch({ salesPersons: [YAMADA], me: YAMADA });
    renderHeader();

    const nav = screen.getByRole("navigation", { name: "グローバルナビ" });
    expect(within(nav).getByRole("link", { name: "日報" })).toHaveAttribute("href", "/reports");
    expect(within(nav).getByRole("link", { name: "顧客マスタ" })).toHaveAttribute(
      "href",
      "/customers",
    );
    expect(within(nav).getByRole("link", { name: "営業マスタ" })).toHaveAttribute(
      "href",
      "/sales-persons",
    );
  });

  it("shows the session-resolved current user once loaded", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: YAMADA });
    renderHeader();

    expect(await screen.findByText("山田太郎（営業）")).toBeInTheDocument();
  });

  it("does not render the sales-person switch dropdown", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: YAMADA });
    renderHeader();

    await screen.findByText("山田太郎（営業）");

    expect(screen.queryByRole("button", { name: "山田太郎（営業）" })).not.toBeInTheDocument();
    expect(screen.queryByText("営業担当者を選択")).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem")).not.toBeInTheDocument();
    expect(screen.queryByText("鈴木一郎（上長）")).not.toBeInTheDocument();
  });

  it("shows an error message when the session cannot be resolved", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], meStatus: 401 });
    renderHeader();

    expect(await screen.findByText("ログインしていません")).toBeInTheDocument();
  });

  it("always shows a logout button directly in the header", () => {
    mockFetch({ salesPersons: [YAMADA], me: YAMADA });
    renderHeader();

    expect(screen.getByRole("button", { name: "ログアウト" })).toBeInTheDocument();
  });

  it("signs out via Supabase Auth and redirects to /login when the logout button is clicked", async () => {
    mockFetch({ salesPersons: [YAMADA], me: YAMADA });
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "ログアウト" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
    expect(signOut).toHaveBeenCalled();
    expect(refreshRouter).toHaveBeenCalled();
  });

  it("disables the logout button while signing out", async () => {
    mockFetch({ salesPersons: [YAMADA], me: YAMADA });
    let resolveSignOut: (value: { error: null }) => void = () => {};
    signOut.mockReturnValue(
      new Promise((resolve) => {
        resolveSignOut = resolve;
      }),
    );
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole("button", { name: "ログアウト" }));

    expect(await screen.findByRole("button", { name: "ログアウト中..." })).toBeDisabled();

    resolveSignOut({ error: null });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/login"));
  });
});
