import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { CustomerForm } from "./customer-form";

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

const COMPANY_A = {
  customer_id: 1,
  company_name: "株式会社A社",
  contact_person: "佐藤様",
  phone: "03-1234-5678",
  email: "sato@a-corp.example.com",
  address: "東京都千代田区...",
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

describe("CustomerForm (create mode)", () => {
  it("rejects submission when the company name is empty (TC-SCR05-01)", async () => {
    const user = userEvent.setup();

    render(<CustomerForm mode="create" />);
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByText("会社名を入力してください")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("registers a new customer on save (TC-SCR05-02)", async () => {
    apiPostMock.mockResolvedValue(COMPANY_A);
    const user = userEvent.setup();

    render(<CustomerForm mode="create" />);
    await user.type(screen.getByLabelText("会社名＊"), "株式会社A社");
    await user.type(screen.getByLabelText("担当者名"), "佐藤様");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith("/customers", {
        company_name: "株式会社A社",
        contact_person: "佐藤様",
        phone: null,
        email: null,
        address: null,
      }),
    );
    expect(push).toHaveBeenCalledWith("/customers");
  });
});

describe("CustomerForm (edit mode)", () => {
  it("loads the existing customer and submits the update (TC-SCR05-03)", async () => {
    apiGetMock.mockResolvedValue(COMPANY_A);
    apiPutMock.mockResolvedValue({ ...COMPANY_A, company_name: "株式会社A社（改称）" });
    const user = userEvent.setup();

    render(<CustomerForm mode="edit" customerId="1" />);
    const nameInput = await screen.findByLabelText("会社名＊");
    expect(nameInput).toHaveValue("株式会社A社");

    await user.clear(nameInput);
    await user.type(nameInput, "株式会社A社（改称）");
    await user.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() =>
      expect(apiPutMock).toHaveBeenCalledWith(
        "/customers/1",
        expect.objectContaining({ company_name: "株式会社A社（改称）" }),
      ),
    );
    expect(push).toHaveBeenCalledWith("/customers");
  });

  it("shows the API's conflict message and does not navigate when deletion is blocked (TC-SCR05-04)", async () => {
    apiGetMock.mockResolvedValue(COMPANY_A);
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiDeleteMock.mockRejectedValue(
      new ApiClientError(409, {
        error: {
          code: "CONFLICT",
          message: "この顧客は訪問記録で使用されているため削除できません",
        },
      }),
    );
    const user = userEvent.setup();

    render(<CustomerForm mode="edit" customerId="1" />);
    await screen.findByLabelText("会社名＊");

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    expect(
      await screen.findByText("この顧客は訪問記録で使用されているため削除できません"),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("deletes an unreferenced customer and returns to the list (TC-SCR05-05)", async () => {
    apiGetMock.mockResolvedValue(COMPANY_A);
    apiDeleteMock.mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(<CustomerForm mode="edit" customerId="1" />);
    await screen.findByLabelText("会社名＊");

    await user.click(screen.getByRole("button", { name: "削除" }));
    await user.click(await screen.findByRole("button", { name: "削除する" }));

    await waitFor(() => expect(apiDeleteMock).toHaveBeenCalledWith("/customers/1"));
    expect(push).toHaveBeenCalledWith("/customers");
  });

  it("shows a not-found message when the customer doesn't exist", async () => {
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiGetMock.mockRejectedValue(
      new ApiClientError(404, { error: { code: "NOT_FOUND", message: "not found" } }),
    );

    render(<CustomerForm mode="edit" customerId="999" />);

    expect(await screen.findByText("指定された顧客が見つかりません")).toBeInTheDocument();
  });
});
