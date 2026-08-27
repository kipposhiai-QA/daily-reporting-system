import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { SalesPersonForm } from "./sales-person-form";

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

vi.mock("@/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  };
});

const apiGetMock = vi.mocked(apiClient.get);
const apiPostMock = vi.mocked(apiClient.post);
const apiPutMock = vi.mocked(apiClient.put);
const apiDeleteMock = vi.mocked(apiClient.delete);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

beforeEach(() => {
  push.mockReset();
  apiGetMock.mockReset();
  apiPostMock.mockReset();
  apiPutMock.mockReset();
  apiDeleteMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SalesPersonForm (create mode)", () => {
  it("rejects submission when name and email are empty (TC-SCR07-01)", async () => {
    const user = userEvent.setup();

    render(<SalesPersonForm mode="create" />);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("氏名を入力してください")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("shows the API's conflict message on a duplicate email (TC-SCR07-02)", async () => {
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiPostMock.mockRejectedValue(
      new ApiClientError(409, {
        error: { code: "CONFLICT", message: "このメールアドレスは既に使用されています" },
      }),
    );
    const user = userEvent.setup();

    render(<SalesPersonForm mode="create" />);
    await user.type(screen.getByLabelText("氏名＊"), "山田太郎");
    await user.type(screen.getByLabelText("メールアドレス＊"), "yamada@example.com");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("このメールアドレスは既に使用されています")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("registers is_manager: true when the checkbox is checked (TC-SCR07-03)", async () => {
    apiPostMock.mockResolvedValue({ ...YAMADA, is_manager: true });
    const user = userEvent.setup();

    render(<SalesPersonForm mode="create" />);
    await user.type(screen.getByLabelText("氏名＊"), "鈴木一郎");
    await user.type(screen.getByLabelText("メールアドレス＊"), "suzuki@example.com");
    await user.click(screen.getByText("上長として登録する"));
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/sales-persons",
        expect.objectContaining({ is_manager: true }),
      ),
    );
    expect(push).toHaveBeenCalledWith("/sales-persons");
  });

  it("registers is_manager: false by default", async () => {
    apiPostMock.mockResolvedValue(YAMADA);
    const user = userEvent.setup();

    render(<SalesPersonForm mode="create" />);
    await user.type(screen.getByLabelText("氏名＊"), "山田太郎");
    await user.type(screen.getByLabelText("メールアドレス＊"), "yamada@example.com");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/sales-persons",
        expect.objectContaining({ is_manager: false }),
      ),
    );
  });
});

describe("SalesPersonForm (edit mode)", () => {
  it("loads the existing sales person", async () => {
    apiGetMock.mockResolvedValue(YAMADA);

    render(<SalesPersonForm mode="edit" salesPersonId="1" />);

    expect(await screen.findByLabelText("氏名＊")).toHaveValue("山田太郎");
    expect(screen.getByLabelText("メールアドレス＊")).toHaveValue("yamada@example.com");
  });

  it("shows the API's conflict message and does not navigate when deletion is blocked (TC-SCR07-04)", async () => {
    apiGetMock.mockResolvedValue(YAMADA);
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiDeleteMock.mockRejectedValue(
      new ApiClientError(409, {
        error: {
          code: "CONFLICT",
          message: "この営業担当者は日報またはコメントで使用されているため削除できません",
        },
      }),
    );
    const user = userEvent.setup();

    render(<SalesPersonForm mode="edit" salesPersonId="1" />);
    await screen.findByLabelText("氏名＊");

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    expect(
      await screen.findByText(
        "この営業担当者は日報またはコメントで使用されているため削除できません",
      ),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced sales person and returns to the list (TC-SCR07-05)", async () => {
    apiGetMock.mockResolvedValue(YAMADA);
    apiDeleteMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<SalesPersonForm mode="edit" salesPersonId="1" />);
    await screen.findByLabelText("氏名＊");

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith("/sales-persons/1"));
    expect(push).toHaveBeenCalledWith("/sales-persons");
  });

  it("shows a not-found message when the sales person doesn't exist", async () => {
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiGetMock.mockRejectedValue(
      new ApiClientError(404, { error: { code: "NOT_FOUND", message: "not found" } }),
    );

    render(<SalesPersonForm mode="edit" salesPersonId="999" />);

    expect(await screen.findByText("指定された営業担当者が見つかりません")).toBeInTheDocument();
  });
});
