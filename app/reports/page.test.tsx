import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/current-user-context";
import ReportListPage from "./page";

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

vi.mock("@/lib/api-client", () => ({
  apiClient: { get: vi.fn() },
}));

const useCurrentUserMock = vi.mocked(useCurrentUser);
const apiGetMock = vi.mocked(apiClient.get);

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
const TANAKA = { ...YAMADA, sales_person_id: 2, name: "田中花子" };

const REPORT_10 = {
  report_id: 10,
  sales_person_id: 1,
  sales_person_name: "山田太郎",
  report_date: "2026-08-25",
  status: "SUBMITTED" as const,
  visit_count: 3,
};

const REPORT_11 = {
  report_id: 11,
  sales_person_id: 1,
  sales_person_name: "山田太郎",
  report_date: "2026-08-24",
  status: "DRAFT" as const,
  visit_count: 1,
};

function mockCurrentUser(overrides: Partial<ReturnType<typeof useCurrentUser>> = {}) {
  useCurrentUserMock.mockReturnValue({
    salesPersons: [YAMADA, TANAKA, SUZUKI_MANAGER],
    currentUser: YAMADA,
    isManager: false,
    isLoading: false,
    error: null,
    selectSalesPersonId: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  push.mockReset();
  apiGetMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ReportListPage", () => {
  it("shows a loading state while the current user is resolving", () => {
    mockCurrentUser({ isLoading: true, currentUser: null });

    render(<ReportListPage />);

    expect(screen.getByText("読み込み中...")).toBeInTheDocument();
    expect(apiGetMock).not.toHaveBeenCalled();
  });

  it("fetches and shows the caller's own reports for a non-manager, hiding the sales-person column and filter (TC-SCR01-01/02)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([REPORT_10, REPORT_11]);

    render(<ReportListPage />);

    expect(await screen.findByText("2026-08-25")).toBeInTheDocument();
    expect(screen.getByText("2026-08-24")).toBeInTheDocument();
    expect(screen.getByText("提出済み")).toBeInTheDocument();
    expect(screen.getByText("下書き")).toBeInTheDocument();
    expect(screen.queryByText("営業担当者")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("営業担当者")).not.toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith("/reports");
  });

  it("shows the sales-person column and filter for a manager (TC-SCR01-03/04)", async () => {
    mockCurrentUser({ currentUser: SUZUKI_MANAGER, isManager: true });
    apiGetMock.mockResolvedValue([REPORT_10]);

    render(<ReportListPage />);

    expect(await screen.findByText("山田太郎")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "営業担当者" })).toBeInTheDocument();
    expect(screen.getByLabelText("営業担当者")).toBeInTheDocument();
  });

  it("re-fetches with sales_person_id when a manager filters and clicks search (TC-SCR01-04)", async () => {
    mockCurrentUser({ currentUser: SUZUKI_MANAGER, isManager: true });
    apiGetMock.mockResolvedValue([REPORT_10]);
    const user = userEvent.setup();

    render(<ReportListPage />);
    await screen.findByText("山田太郎");

    await user.click(screen.getByLabelText("営業担当者"));
    await user.click(await screen.findByRole("option", { name: "山田太郎" }));
    await user.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() => expect(apiGetMock).toHaveBeenLastCalledWith("/reports?sales_person_id=1"));
  });

  it("re-fetches with date_from/date_to when the date range is applied (TC-SCR01-05)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([]);
    const user = userEvent.setup();

    render(<ReportListPage />);
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledWith("/reports"));

    fireEvent.change(screen.getByLabelText("対象日（開始）"), { target: { value: "2026-08-25" } });
    await user.click(screen.getByRole("button", { name: "検索" }));

    await waitFor(() =>
      expect(apiGetMock).toHaveBeenLastCalledWith("/reports?date_from=2026-08-25"),
    );
  });

  it("links the new-report button to /reports/new (TC-SCR01-06)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([]);

    render(<ReportListPage />);

    expect(screen.getByRole("link", { name: "＋新規作成" })).toHaveAttribute(
      "href",
      "/reports/new",
    );
  });

  it("navigates to the report detail when a row is clicked (TC-SCR01-07)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([REPORT_10]);
    const user = userEvent.setup();

    render(<ReportListPage />);
    const row = (await screen.findByText("2026-08-25")).closest("tr");
    expect(row).not.toBeNull();

    await user.click(within(row!).getByText("2026-08-25"));

    expect(push).toHaveBeenCalledWith("/reports/10");
  });

  it("shows a no-data message when the list is empty (TC-SCR01-08)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue([]);

    render(<ReportListPage />);

    expect(await screen.findByText("データがありません")).toBeInTheDocument();
  });

  it("shows an error message when the fetch fails", async () => {
    mockCurrentUser();
    apiGetMock.mockRejectedValue(new Error("network error"));

    render(<ReportListPage />);

    expect(await screen.findByText("日報一覧の取得に失敗しました")).toBeInTheDocument();
  });
});
