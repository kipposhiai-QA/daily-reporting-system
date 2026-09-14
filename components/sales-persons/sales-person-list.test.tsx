import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentUser } from "@/lib/current-user-context";
import { SalesPersonList } from "./sales-person-list";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

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

const SUZUKI = {
  ...YAMADA,
  sales_person_id: 5,
  name: "鈴木一郎",
  email: "suzuki@example.com",
  department: "営業2課",
  is_manager: true,
};

function mockCurrentUser(overrides: Partial<ReturnType<typeof useCurrentUser>> = {}) {
  useCurrentUserMock.mockReturnValue({
    salesPersons: [YAMADA, SUZUKI],
    currentUser: YAMADA,
    isManager: false,
    isLoading: false,
    error: null,
    selectSalesPersonId: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  push.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SalesPersonList", () => {
  it("displays name, email, department, and a converted role for each row", () => {
    mockCurrentUser();

    render(<SalesPersonList />);

    expect(screen.getByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByText("yamada@example.com")).toBeInTheDocument();
    expect(screen.getByText("営業1課")).toBeInTheDocument();
    expect(screen.getByText("営業")).toBeInTheDocument();
    expect(screen.getByText("鈴木一郎")).toBeInTheDocument();
    expect(screen.getByText("上長")).toBeInTheDocument();
  });

  it("links the new-registration button to /sales-persons/new", () => {
    mockCurrentUser();

    render(<SalesPersonList />);

    expect(screen.getByRole("link", { name: "＋新規登録" })).toHaveAttribute(
      "href",
      "/sales-persons/new",
    );
  });

  it("links the invite button to /sales-persons/invite for a manager (Issue #74)", () => {
    mockCurrentUser({ currentUser: SUZUKI, isManager: true });

    render(<SalesPersonList />);

    expect(screen.getByRole("link", { name: "招待する" })).toHaveAttribute(
      "href",
      "/sales-persons/invite",
    );
  });

  it("hides the invite button for a non-manager (Issue #102)", () => {
    mockCurrentUser({ currentUser: YAMADA, isManager: false });

    render(<SalesPersonList />);

    expect(screen.queryByRole("link", { name: "招待する" })).not.toBeInTheDocument();
  });

  it("navigates to the edit screen when a row is clicked", async () => {
    mockCurrentUser();
    const user = userEvent.setup();

    render(<SalesPersonList />);
    await user.click(screen.getByText("山田太郎"));

    expect(push).toHaveBeenCalledWith("/sales-persons/1/edit");
  });

  it("shows a loading message while the list is loading", () => {
    mockCurrentUser({ salesPersons: [], isLoading: true, currentUser: null });

    render(<SalesPersonList />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
  });

  it("shows an empty state message when there is no data", () => {
    mockCurrentUser({ salesPersons: [], currentUser: null });

    render(<SalesPersonList />);

    expect(screen.getByText("データがありません")).toBeInTheDocument();
  });
});
