import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api-client";
import { SalesPersonInviteForm } from "./sales-person-invite-form";

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

const apiPostMock = vi.mocked(apiClient.post);

const SATO = {
  sales_person_id: 3,
  name: "佐藤次郎",
  email: "sato@example.com",
  department: null,
  is_manager: false,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

beforeEach(() => {
  push.mockReset();
  apiPostMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("SalesPersonInviteForm", () => {
  it("caps each field's input length to match the API's max length (Issue #96)", () => {
    render(<SalesPersonInviteForm />);

    expect(screen.getByLabelText("氏名＊")).toHaveAttribute("maxLength", "50");
    expect(screen.getByLabelText("メールアドレス＊")).toHaveAttribute("maxLength", "254");
    expect(screen.getByLabelText("部署")).toHaveAttribute("maxLength", "100");
  });

  it("rejects submission when name is empty", async () => {
    const user = userEvent.setup();
    render(<SalesPersonInviteForm />);

    await user.type(screen.getByLabelText("メールアドレス＊"), "sato@example.com");
    await user.click(screen.getByRole("button", { name: "招待する" }));

    expect(await screen.findByText("氏名を入力してください")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("rejects submission when email is empty", async () => {
    const user = userEvent.setup();
    render(<SalesPersonInviteForm />);

    await user.type(screen.getByLabelText("氏名＊"), "佐藤次郎");
    await user.click(screen.getByRole("button", { name: "招待する" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeInTheDocument();
    expect(apiPostMock).not.toHaveBeenCalled();
  });

  it("invites via POST /sales-persons/invite and navigates to the list on success", async () => {
    apiPostMock.mockResolvedValue(SATO);
    const user = userEvent.setup();
    render(<SalesPersonInviteForm />);

    await user.type(screen.getByLabelText("氏名＊"), "佐藤次郎");
    await user.type(screen.getByLabelText("メールアドレス＊"), "sato@example.com");
    await user.click(screen.getByRole("button", { name: "招待する" }));

    await vi.waitFor(() => expect(push).toHaveBeenCalledWith("/sales-persons"));
    expect(apiPostMock).toHaveBeenCalledWith("/sales-persons/invite", {
      name: "佐藤次郎",
      email: "sato@example.com",
      department: null,
      is_manager: false,
    });
  });

  it("registers is_manager: true when the checkbox is checked", async () => {
    apiPostMock.mockResolvedValue({ ...SATO, is_manager: true });
    const user = userEvent.setup();
    render(<SalesPersonInviteForm />);

    await user.type(screen.getByLabelText("氏名＊"), "佐藤次郎");
    await user.type(screen.getByLabelText("メールアドレス＊"), "sato@example.com");
    await user.click(screen.getByLabelText("上長として登録する"));
    await user.click(screen.getByRole("button", { name: "招待する" }));

    await vi.waitFor(() =>
      expect(apiPostMock).toHaveBeenCalledWith(
        "/sales-persons/invite",
        expect.objectContaining({ is_manager: true }),
      ),
    );
  });

  it("shows the API's conflict message when the invite fails", async () => {
    const { ApiClientError } =
      await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client");
    apiPostMock.mockRejectedValue(
      new ApiClientError(409, {
        error: { code: "CONFLICT", message: "招待メールの送信に失敗しました" },
      }),
    );
    const user = userEvent.setup();
    render(<SalesPersonInviteForm />);

    await user.type(screen.getByLabelText("氏名＊"), "佐藤次郎");
    await user.type(screen.getByLabelText("メールアドレス＊"), "sato@example.com");
    await user.click(screen.getByRole("button", { name: "招待する" }));

    expect(await screen.findByText("招待メールの送信に失敗しました")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("links the cancel button back to /sales-persons", () => {
    render(<SalesPersonInviteForm />);

    expect(screen.getByRole("link", { name: "キャンセル" })).toHaveAttribute(
      "href",
      "/sales-persons",
    );
  });
});
