import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/current-user-context";
import { ReportDetail } from "./report-detail";

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

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

const useCurrentUserMock = vi.mocked(useCurrentUser);
const apiGetMock = vi.mocked(apiClient.get);
const apiPostMock = vi.mocked(apiClient.post);

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
  is_manager: true,
};

const REPORT_10 = {
  report_id: 10,
  sales_person_id: 1,
  sales_person_name: "山田太郎",
  report_date: "2026-08-25",
  status: "SUBMITTED" as const,
  problem: "A社の見積もり承認が遅れている",
  plan: "C社へ初回訪問予定",
  created_at: "2026-08-25T09:00:00+09:00",
  updated_at: "2026-08-25T09:00:00+09:00",
  visit_records: [
    {
      visit_id: 101,
      customer_id: 1,
      customer_name: "株式会社A社",
      visit_content: "新商品の提案を実施",
      visit_time: "10:00",
      created_at: "2026-08-25T18:00:00+09:00",
    },
    {
      visit_id: 102,
      customer_id: 2,
      customer_name: "株式会社B社",
      visit_content: "定期フォロー訪問",
      visit_time: "13:30",
      created_at: "2026-08-25T18:00:00+09:00",
    },
  ],
  comments: [
    {
      comment_id: 201,
      manager_id: 5,
      manager_name: "鈴木一郎",
      comment: "見積もりの件、私からも確認します",
      created_at: "2026-08-25T14:10:00+09:00",
    },
    {
      comment_id: 202,
      manager_id: 5,
      manager_name: "鈴木一郎",
      comment: "承知しました",
      created_at: "2026-08-25T15:00:00+09:00",
    },
  ],
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
  apiGetMock.mockReset();
  apiPostMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ReportDetail", () => {
  it("displays visit records ordered by visit time (TC-SCR03-01)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue(REPORT_10);

    render(<ReportDetail reportId="10" />);

    const items = await screen.findAllByRole("listitem");
    const visitItems = items.filter((item) => item.textContent?.includes("株式会社"));
    expect(visitItems[0]).toHaveTextContent("10:00");
    expect(visitItems[0]).toHaveTextContent("株式会社A社");
    expect(visitItems[1]).toHaveTextContent("13:30");
    expect(visitItems[1]).toHaveTextContent("株式会社B社");
  });

  it("displays Problem and Plan as-is (TC-SCR03-02)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue(REPORT_10);

    render(<ReportDetail reportId="10" />);

    expect(await screen.findByText("A社の見積もり承認が遅れている")).toBeInTheDocument();
    expect(screen.getByText("C社へ初回訪問予定")).toBeInTheDocument();
  });

  it("displays comments ordered oldest to newest (TC-SCR03-03)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue(REPORT_10);

    render(<ReportDetail reportId="10" />);

    const items = await screen.findAllByRole("listitem");
    const commentItems = items.filter((item) => item.textContent?.includes("鈴木一郎"));
    expect(commentItems[0]).toHaveTextContent("見積もりの件、私からも確認します");
    expect(commentItems[1]).toHaveTextContent("承知しました");
  });

  it("shows the comment form for a manager (TC-SCR03-04)", async () => {
    mockCurrentUser({ currentUser: SUZUKI, isManager: true });
    apiGetMock.mockResolvedValue(REPORT_10);

    render(<ReportDetail reportId="10" />);

    expect(await screen.findByLabelText("コメント入力欄")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "投稿" })).toBeInTheDocument();
  });

  it("hides the comment form for a sales person (TC-SCR03-05)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue(REPORT_10);

    render(<ReportDetail reportId="10" />);

    await screen.findByText("A社の見積もり承認が遅れている");
    expect(screen.queryByLabelText("コメント入力欄")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "投稿" })).not.toBeInTheDocument();
  });

  it("reflects a posted comment immediately (TC-SCR03-06)", async () => {
    mockCurrentUser({ currentUser: SUZUKI, isManager: true });
    apiGetMock.mockResolvedValue(REPORT_10);
    apiPostMock.mockResolvedValue({
      comment_id: 203,
      report_id: 10,
      manager_id: 5,
      manager_name: "鈴木一郎",
      comment: "追加コメントです",
      created_at: "2026-08-25T16:00:00+09:00",
    });
    const user = userEvent.setup();

    render(<ReportDetail reportId="10" />);
    const textarea = await screen.findByLabelText("コメント入力欄");
    await user.type(textarea, "追加コメントです");
    await user.click(screen.getByRole("button", { name: "投稿" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/reports/10/comments", {
        comment: "追加コメントです",
      }),
    );
    expect(await screen.findByText(/追加コメントです/)).toBeInTheDocument();
  });

  it("shows the edit button only to the report's owner (TC-SCR03-07)", async () => {
    mockCurrentUser();
    apiGetMock.mockResolvedValue(REPORT_10);

    const { rerender } = render(<ReportDetail reportId="10" />);
    expect(await screen.findByRole("link", { name: "編集" })).toBeInTheDocument();

    mockCurrentUser({ currentUser: SUZUKI, isManager: true });
    rerender(<ReportDetail reportId="10" />);
    await screen.findByText("A社の見積もり承認が遅れている");
    expect(screen.queryByRole("link", { name: "編集" })).not.toBeInTheDocument();
  });

  it("denies access to another user's DRAFT report (TC-SCR03-08)", async () => {
    mockCurrentUser({ currentUser: SUZUKI, isManager: true });
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiGetMock.mockRejectedValue(
      new ApiClientError(403, {
        error: { code: "FORBIDDEN", message: "この日報にアクセスする権限がありません" },
      }),
    );

    render(<ReportDetail reportId="11" />);

    expect(await screen.findByText("この日報にアクセスする権限がありません")).toBeInTheDocument();
  });
});
