import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/current-user-context";
import { ReportForm } from "./report-form";

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
const apiPutMock = vi.mocked(apiClient.put);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

const TANAKA = { ...YAMADA, sales_person_id: 2, name: "田中花子" };

const COMPANY_A = {
  customer_id: 1,
  company_name: "株式会社A社",
  contact_person: null,
  phone: null,
  email: null,
  address: null,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

const COMPANY_B = { ...COMPANY_A, customer_id: 2, company_name: "株式会社B社" };

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
      created_at: "2026-08-25T09:00:00+09:00",
    },
  ],
  comments: [],
};

function mockCurrentUser(overrides: Partial<ReturnType<typeof useCurrentUser>> = {}) {
  useCurrentUserMock.mockReturnValue({
    salesPersons: [YAMADA, TANAKA],
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
  apiPostMock.mockReset();
  apiPutMock.mockReset();
  apiGetMock.mockImplementation(async (path: string) => {
    if (path === "/customers") return [COMPANY_A, COMPANY_B];
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ReportForm (create mode)", () => {
  it("adds a visit record row each time the add button is clicked (TC-SCR02-01)", async () => {
    mockCurrentUser();
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    const addButton = await screen.findByRole("button", { name: "＋訪問記録を追加" });

    await user.click(addButton);
    await user.click(addButton);
    await user.click(addButton);

    expect(screen.getAllByLabelText("訪問記録の顧客")).toHaveLength(3);
  });

  it("removes a row when its delete button is clicked (TC-SCR02-02)", async () => {
    mockCurrentUser();
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    const addButton = await screen.findByRole("button", { name: "＋訪問記録を追加" });
    await user.click(addButton);
    await user.click(addButton);

    const deleteButtons = screen.getAllByRole("button", { name: "この訪問記録を削除" });
    await user.click(deleteButtons[0]);

    expect(screen.getAllByLabelText("訪問記録の顧客")).toHaveLength(1);
  });

  it("rejects submission when only the customer is selected on a row (TC-SCR02-03)", async () => {
    mockCurrentUser();
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await user.click(await screen.findByRole("button", { name: "＋訪問記録を追加" }));
    await user.click(screen.getByLabelText("訪問記録の顧客"));
    await user.click(await screen.findByRole("option", { name: "株式会社A社" }));

    await user.click(screen.getByRole("button", { name: "提出する" }));

    expect(await screen.findByText(/顧客と訪問内容の両方を入力してください/)).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("saves as DRAFT with zero visit records (TC-SCR02-04, TC-SCR02-09)", async () => {
    mockCurrentUser();
    apiPostMock.mockResolvedValue({ ...REPORT_10, status: "DRAFT" });
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await screen.findByRole("button", { name: "提出する" });

    await user.click(screen.getByRole("button", { name: "下書き保存" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/reports",
        expect.objectContaining({ status: "DRAFT", visit_records: [] }),
      ),
    );
    expect(push).toHaveBeenCalledWith("/reports");
  });

  it("submits with SUBMITTED status, making the report visible to managers (TC-SCR02-10)", async () => {
    mockCurrentUser();
    apiPostMock.mockResolvedValue({ ...REPORT_10, status: "SUBMITTED" });
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await user.click(await screen.findByRole("button", { name: "＋訪問記録を追加" }));
    await user.click(screen.getByLabelText("訪問記録の顧客"));
    await user.click(await screen.findByRole("option", { name: "株式会社A社" }));
    await user.type(screen.getByLabelText("訪問内容"), "新商品の提案を実施");

    await user.click(screen.getByRole("button", { name: "提出する" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/reports",
        expect.objectContaining({ status: "SUBMITTED" }),
      ),
    );
    expect(push).toHaveBeenCalledWith("/reports");
    // 提出済み日報が上長の一覧に表示されることは、上長スコープのAPIレスポンスをそのまま
    // 描画する report-list 側で検証する（app/reports/page.test.tsx の TC-SCR01-03/04、
    // および TC-API-RPT-03 相当のAPIテストで担保）。
  });

  it("rejects submitting with zero visit records (TC-SCR02-05)", async () => {
    mockCurrentUser();
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await user.click(await screen.findByRole("button", { name: "提出する" }));

    expect(
      await screen.findByText("提出するには訪問記録を1件以上入力してください"),
    ).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("shows the API's conflict message on a duplicate date (TC-SCR02-06)", async () => {
    mockCurrentUser();
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiPostMock.mockRejectedValue(
      new ApiClientError(409, {
        error: { code: "CONFLICT", message: "同じ営業担当者・対象日の日報が既に存在します" },
      }),
    );
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await user.click(await screen.findByRole("button", { name: "下書き保存" }));

    expect(
      await screen.findByText("同じ営業担当者・対象日の日報が既に存在します"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("defaults the target date to today", async () => {
    mockCurrentUser();

    render(<ReportForm mode="create" />);
    const dateInput = await screen.findByLabelText("対象日");

    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    expect(dateInput).toHaveValue(expected);
  });
});

describe("ReportForm (edit mode)", () => {
  it("loads the existing report and submits the update to its own detail page (TC-SCR02-07)", async () => {
    mockCurrentUser();
    apiGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers") return [COMPANY_A, COMPANY_B];
      if (path === "/reports/10") return REPORT_10;
      throw new Error(`unexpected GET ${path}`);
    });
    apiPutMock.mockResolvedValue(REPORT_10);
    const user = userEvent.setup();

    render(<ReportForm mode="edit" reportId="10" />);

    const problemInput = await screen.findByLabelText("Problem（課題・相談）");
    expect(problemInput).toHaveValue("A社の見積もり承認が遅れている");

    await user.clear(problemInput);
    await user.type(problemInput, "見積もり承認済み");
    await user.click(screen.getByRole("button", { name: "提出する" }));

    await waitFor(() =>
      expect(apiPutMock).toHaveBeenCalledWith(
        "/reports/10",
        expect.objectContaining({ problem: "見積もり承認済み", status: "SUBMITTED" }),
      ),
    );
    expect(push).toHaveBeenCalledWith("/reports/10");
  });

  it("denies access when the report belongs to another sales person (TC-SCR02-08)", async () => {
    mockCurrentUser({ currentUser: TANAKA });
    apiGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers") return [COMPANY_A, COMPANY_B];
      if (path === "/reports/10") return REPORT_10;
      throw new Error(`unexpected GET ${path}`);
    });

    render(<ReportForm mode="edit" reportId="10" />);

    expect(await screen.findByText("この日報を編集する権限がありません")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提出する" })).not.toBeInTheDocument();
  });

  it("shows a not-found message when the report doesn't exist", async () => {
    mockCurrentUser();
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers") return [COMPANY_A, COMPANY_B];
      if (path === "/reports/999") {
        throw new ApiClientError(404, { error: { code: "NOT_FOUND", message: "not found" } });
      }
      throw new Error(`unexpected GET ${path}`);
    });

    render(<ReportForm mode="edit" reportId="999" />);

    expect(await screen.findByText("指定された日報が見つかりません")).toBeInTheDocument();
  });
});

describe("ReportForm (validation error accessibility, issue #50)", () => {
  it("exposes the incomplete-row validation error via role=alert (TC-SCR02-03相当)", async () => {
    mockCurrentUser();
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await user.click(await screen.findByRole("button", { name: "＋訪問記録を追加" }));
    await user.click(screen.getByLabelText("訪問記録の顧客"));
    await user.click(await screen.findByRole("option", { name: "株式会社A社" }));

    await user.click(screen.getByRole("button", { name: "提出する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("顧客と訪問内容の両方を入力してください");
  });

  it("exposes the zero-visit-record submission error via role=alert (TC-SCR02-05相当)", async () => {
    mockCurrentUser();
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await user.click(await screen.findByRole("button", { name: "提出する" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("提出するには訪問記録を1件以上入力してください");
  });

  it("exposes the API conflict error via role=alert (TC-SCR02-06相当)", async () => {
    mockCurrentUser();
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiPostMock.mockRejectedValue(
      new ApiClientError(409, {
        error: { code: "CONFLICT", message: "同じ営業担当者・対象日の日報が既に存在します" },
      }),
    );
    const user = userEvent.setup();

    render(<ReportForm mode="create" />);
    await user.click(await screen.findByRole("button", { name: "下書き保存" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("同じ営業担当者・対象日の日報が既に存在します");
  });
});

describe("ReportForm (user switch with unsaved changes, issue #48)", () => {
  beforeEach(() => {
    apiGetMock.mockImplementation(async (path: string) => {
      if (path === "/customers") return [COMPANY_A, COMPANY_B];
      if (path === "/reports/10") return REPORT_10;
      throw new Error(`unexpected GET ${path}`);
    });
  });

  it("asks for confirmation instead of silently discarding an unsaved edit", async () => {
    const selectSalesPersonId = vi.fn();
    mockCurrentUser({ selectSalesPersonId });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    const { rerender } = render(<ReportForm mode="edit" reportId="10" />);
    const problemInput = await screen.findByLabelText("Problem（課題・相談）");
    expect(problemInput).toHaveValue("A社の見積もり承認が遅れている");

    await user.clear(problemInput);
    await user.type(problemInput, "編集中の未保存メモ");

    mockCurrentUser({ currentUser: TANAKA, selectSalesPersonId });
    rerender(<ReportForm mode="edit" reportId="10" />);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // キャンセルされたので直前のユーザー(山田太郎)に戻すよう要求する
    expect(selectSalesPersonId).toHaveBeenCalledWith(1);
    // 入力中の内容は破棄されず残っている
    expect(screen.getByLabelText("Problem（課題・相談）")).toHaveValue("編集中の未保存メモ");

    confirmSpy.mockRestore();
  });

  it("does not discard the unsaved edit even after the reverted user is re-applied", async () => {
    const selectSalesPersonId = vi.fn();
    mockCurrentUser({ selectSalesPersonId });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const user = userEvent.setup();

    const { rerender } = render(<ReportForm mode="edit" reportId="10" />);
    const problemInput = await screen.findByLabelText("Problem（課題・相談）");
    await user.clear(problemInput);
    await user.type(problemInput, "編集中の未保存メモ");

    mockCurrentUser({ currentUser: TANAKA, selectSalesPersonId });
    rerender(<ReportForm mode="edit" reportId="10" />);
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    // selectSalesPersonId(1) の呼び出しを受けて、切替元コンポーネントが currentUser を
    // 山田太郎に戻したことを模倣する。
    mockCurrentUser({ selectSalesPersonId });
    rerender(<ReportForm mode="edit" reportId="10" />);

    // 元のユーザーに戻った際に再読み込みが走り入力内容が上書きされていないこと
    expect(screen.getByLabelText("Problem（課題・相談）")).toHaveValue("編集中の未保存メモ");
    // 確認ダイアログは最初の1回のみ（差し戻し後は再読み込みされない）
    expect(confirmSpy).toHaveBeenCalledTimes(1);

    confirmSpy.mockRestore();
  });

  it("proceeds with the switch and reloads the report once confirmed", async () => {
    const selectSalesPersonId = vi.fn();
    mockCurrentUser({ selectSalesPersonId });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    const { rerender } = render(<ReportForm mode="edit" reportId="10" />);
    const problemInput = await screen.findByLabelText("Problem（課題・相談）");
    await user.clear(problemInput);
    await user.type(problemInput, "編集中の未保存メモ");

    mockCurrentUser({ currentUser: TANAKA, selectSalesPersonId });
    rerender(<ReportForm mode="edit" reportId="10" />);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    // 別営業の日報のため権限エラー表示に切り替わる（＝再読み込みが行われた）
    expect(await screen.findByText("この日報を編集する権限がありません")).toBeInTheDocument();
    expect(selectSalesPersonId).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("switches without confirmation when there are no unsaved changes", async () => {
    const selectSalesPersonId = vi.fn();
    mockCurrentUser({ selectSalesPersonId });
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();

    const { rerender } = render(<ReportForm mode="edit" reportId="10" />);
    await user.click(await screen.findByRole("button", { name: "＋訪問記録を追加" }));
    await user.click(screen.getAllByRole("button", { name: "この訪問記録を削除" })[1]);

    mockCurrentUser({ currentUser: TANAKA, selectSalesPersonId });
    rerender(<ReportForm mode="edit" reportId="10" />);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(await screen.findByText("この日報を編集する権限がありません")).toBeInTheDocument();

    confirmSpy.mockRestore();
  });

  it("does not prompt on user switch in create mode, where nothing is discarded", async () => {
    const selectSalesPersonId = vi.fn();
    mockCurrentUser({ selectSalesPersonId });
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();

    const { rerender } = render(<ReportForm mode="create" />);
    const problemInput = await screen.findByLabelText("Problem（課題・相談）");
    await user.type(problemInput, "新規メモ");

    mockCurrentUser({ currentUser: TANAKA, selectSalesPersonId });
    rerender(<ReportForm mode="create" />);

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(problemInput).toHaveValue("新規メモ");

    confirmSpy.mockRestore();
  });
});
