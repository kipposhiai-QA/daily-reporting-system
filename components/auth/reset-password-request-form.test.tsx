import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { ResetPasswordRequestForm } from "./reset-password-request-form";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));

const resetPasswordForEmail = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);

beforeEach(() => {
  resetPasswordForEmail.mockReset();
  createClientMock.mockReset();
  createClientMock.mockReturnValue({
    auth: { resetPasswordForEmail },
  } as unknown as ReturnType<typeof createClient>);
});

describe("ResetPasswordRequestForm", () => {
  it("renders the email field", () => {
    render(<ResetPasswordRequestForm />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
  });

  it("links back to the login page", () => {
    render(<ResetPasswordRequestForm />);

    expect(screen.getByRole("link", { name: "ログイン画面に戻る" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("rejects submission when the email is empty", async () => {
    const user = userEvent.setup();
    render(<ResetPasswordRequestForm />);

    await user.click(screen.getByRole("button", { name: "リセットメールを送信" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeInTheDocument();
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("sends a reset email via Supabase Auth and shows a success message", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordRequestForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.click(screen.getByRole("button", { name: "リセットメールを送信" }));

    expect(
      await screen.findByText(
        "パスワード再設定用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください",
      ),
    ).toBeInTheDocument();
    expect(resetPasswordForEmail).toHaveBeenCalledWith("yamada@example.com", {
      redirectTo: expect.stringContaining("/reset-password/confirm"),
    });
  });

  it("hides the form and shows only the success message once sent", async () => {
    resetPasswordForEmail.mockResolvedValue({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordRequestForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.click(screen.getByRole("button", { name: "リセットメールを送信" }));

    await screen.findByRole("status");
    expect(screen.queryByLabelText("メールアドレス")).not.toBeInTheDocument();
  });

  it("shows an error message when Supabase Auth returns an error", async () => {
    resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { name: "AuthApiError", message: "Something went wrong" },
    });
    const user = userEvent.setup();
    render(<ResetPasswordRequestForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.click(screen.getByRole("button", { name: "リセットメールを送信" }));

    expect(
      await screen.findByText("メールの送信に失敗しました。時間をおいて再度お試しください"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("disables the submit button while sending", async () => {
    let resolveSend: (value: { data: unknown; error: null }) => void = () => {};
    resetPasswordForEmail.mockReturnValue(
      new Promise((resolve) => {
        resolveSend = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<ResetPasswordRequestForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.click(screen.getByRole("button", { name: "リセットメールを送信" }));

    expect(await screen.findByRole("button", { name: "送信中..." })).toBeDisabled();

    resolveSend({ data: {}, error: null });
    await screen.findByRole("status");
  });
});
