import { render, screen, waitFor, within } from "@testing-library/react";
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

function mockSalesPersonsFetch(list: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(list) }),
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
    mockSalesPersonsFetch([YAMADA]);
    renderHeader();

    expect(screen.getByRole("link", { name: "営業日報システム" })).toHaveAttribute("href", "/");
  });

  it("renders nothing on the login page", () => {
    usePathnameMock.mockReturnValue("/login");
    mockSalesPersonsFetch([YAMADA]);
    const { container } = renderHeader();

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the three global nav links pointing at the correct routes", () => {
    mockSalesPersonsFetch([YAMADA]);
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

  it("shows a loading state before the sales-persons list resolves", () => {
    mockSalesPersonsFetch([YAMADA]);
    renderHeader();

    expect(screen.getByRole("button", { name: "読み込み中..." })).toBeDisabled();
  });

  it("shows the auto-selected current user once loaded", async () => {
    mockSalesPersonsFetch([YAMADA, SUZUKI_MANAGER]);
    renderHeader();

    expect(await screen.findByRole("button", { name: "山田太郎（営業）" })).toBeInTheDocument();
  });

  it("switches the current user when a dropdown item is selected", async () => {
    const user = userEvent.setup();
    mockSalesPersonsFetch([YAMADA, SUZUKI_MANAGER]);
    renderHeader();

    const trigger = await screen.findByRole("button", { name: "山田太郎（営業）" });
    await user.click(trigger);
    await user.click(await screen.findByRole("menuitem", { name: "鈴木一郎（上長）" }));

    expect(await screen.findByRole("button", { name: "鈴木一郎（上長）" })).toBeInTheDocument();
    await waitFor(() => expect(getStoredSalesPersonId()).toBe(5));
  });

  it("shows an error message instead of the switcher when the fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    renderHeader();

    expect(await screen.findByText("営業担当者一覧の取得に失敗しました")).toBeInTheDocument();
  });
});
