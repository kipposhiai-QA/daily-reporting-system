import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCurrentUser } from "@/lib/current-user-context";
import { HomePage } from "./home-page";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/lib/current-user-context", () => ({
  useCurrentUser: vi.fn(),
}));

const useCurrentUserMock = vi.mocked(useCurrentUser);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

function mockCurrentUser(overrides: Partial<ReturnType<typeof useCurrentUser>> = {}) {
  useCurrentUserMock.mockReturnValue({
    salesPersons: [],
    currentUser: null,
    isManager: false,
    isLoading: false,
    error: null,
    selectSalesPersonId: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("HomePage", () => {
  it("shows the four feature card titles when not logged in", () => {
    mockCurrentUser();

    render(<HomePage />);

    expect(screen.getByText("クイックスタート")).toBeInTheDocument();
    expect(screen.getByText("日報管理")).toBeInTheDocument();
    expect(screen.getByText("顧客管理")).toBeInTheDocument();
    expect(screen.getByText("システム設定")).toBeInTheDocument();
  });

  it("links each card to the correct destination when not logged in", () => {
    mockCurrentUser();

    render(<HomePage />);

    expect(screen.getByRole("link", { name: "ログインページへ" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(screen.getByRole("link", { name: "日報一覧へ" })).toHaveAttribute("href", "/reports");
    expect(screen.getByRole("link", { name: "顧客管理へ" })).toHaveAttribute("href", "/customers");
    expect(screen.getByRole("link", { name: "設定へ" })).toHaveAttribute("href", "/sales-persons");
  });

  it("hides the quick-start (login) card once logged in", () => {
    // ログイン済みでも「クイックスタート」カードが表示されたままだと、押しても
    // proxy.ts が /login → / へ即座にリダイレクトするだけで無反応に見えてしまう
    // ため、ログイン中はこのカードを取り除く。
    mockCurrentUser({ currentUser: YAMADA });

    render(<HomePage />);

    expect(screen.queryByText("クイックスタート")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "ログインページへ" })).not.toBeInTheDocument();
    expect(screen.getByText("日報管理")).toBeInTheDocument();
    expect(screen.getByText("顧客管理")).toBeInTheDocument();
    expect(screen.getByText("システム設定")).toBeInTheDocument();
  });

  it("still shows the quick-start card while the login state is loading", () => {
    mockCurrentUser({ isLoading: true, currentUser: null });

    render(<HomePage />);

    expect(screen.getByText("クイックスタート")).toBeInTheDocument();
  });
});
