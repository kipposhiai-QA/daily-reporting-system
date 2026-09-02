import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { getStoredSalesPersonId } from "@/lib/api-client";
import { CurrentUserProvider } from "@/lib/current-user-context";
import { SiteHeader } from "./site-header";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));

const usePathnameMock = vi.mocked(usePathname);

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
  usePathnameMock.mockReturnValue("/reports");
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

  it("shows a loading state before the session resolves", () => {
    mockFetch({ salesPersons: [YAMADA], me: YAMADA });
    renderHeader();

    expect(screen.getByRole("button", { name: "読み込み中..." })).toBeDisabled();
  });

  it("shows the session-resolved current user once loaded", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: YAMADA });
    renderHeader();

    expect(await screen.findByRole("button", { name: "山田太郎（営業）" })).toBeInTheDocument();
  });

  it("does not change the current user when a dropdown item is selected (manual switch is inert)", async () => {
    const user = userEvent.setup();
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: YAMADA });
    renderHeader();

    const trigger = await screen.findByRole("button", { name: "山田太郎（営業）" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "鈴木一郎（上長）" }));

    expect(screen.getByRole("button", { name: "山田太郎（営業）" })).toBeInTheDocument();
    expect(getStoredSalesPersonId()).toBe(1);
  });

  it("shows an error message instead of the switcher when the session cannot be resolved", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], meStatus: 401 });
    renderHeader();

    expect(await screen.findByText("ログインしていません")).toBeInTheDocument();
  });
});
