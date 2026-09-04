import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { UpdatePasswordForm } from "./update-password-form";

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href as string} {...props}>
      {children}
    </a>
  ),
}));

const updateUser = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);

beforeEach(() => {
  updateUser.mockReset();
  signOut.mockReset().mockResolvedValue({ error: null });
  createClientMock.mockReset();
  createClientMock.mockReturnValue({
    auth: { updateUser, signOut },
  } as unknown as ReturnType<typeof createClient>);
});

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  password: string,
  confirmation: string,
) {
  if (password) {
    await user.type(screen.getByLabelText("新しいパスワード"), password);
  }
  if (confirmation) {
    await user.type(screen.getByLabelText("新しいパスワード（確認）"), confirmation);
  }
  await user.click(screen.getByRole("button", { name: "パスワードを更新" }));
}

describe("UpdatePasswordForm", () => {
  it("renders the new password fields", () => {
    render(<UpdatePasswordForm />);

    expect(screen.getByLabelText("新しいパスワード")).toBeInTheDocument();
    expect(screen.getByLabelText("新しいパスワード（確認）")).toBeInTheDocument();
  });

  it("rejects submission when the password is empty", async () => {
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "", "");

    expect(await screen.findByText("新しいパスワードを入力してください")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects submission when the password is too short", async () => {
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "abc12", "abc12");

    expect(await screen.findByText("パスワードは6文字以上で入力してください")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects submission when the passwords do not match", async () => {
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "newpassword1", "newpassword2");

    expect(await screen.findByText("パスワードが一致しません")).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("updates the password via Supabase Auth, signs out, and shows a success message", async () => {
    updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "newpassword1", "newpassword1");

    expect(
      await screen.findByText("パスワードを更新しました。新しいパスワードでログインしてください"),
    ).toBeInTheDocument();
    expect(updateUser).toHaveBeenCalledWith({ password: "newpassword1" });
    expect(signOut).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "ログイン画面へ" })).toHaveAttribute("href", "/login");
  });

  it("shows the link-expired message when Supabase Auth returns an error without a recognized code (e.g. invalid session)", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { name: "AuthApiError", message: "Auth session missing" },
    });
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "newpassword1", "newpassword1");

    expect(
      await screen.findByText(
        "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。もう一度パスワード再設定をお試しください",
      ),
    ).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("shows a same-password message when Supabase Auth returns the same_password error code", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: {
        name: "AuthApiError",
        message: "New password should be different",
        code: "same_password",
      },
    });
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "newpassword1", "newpassword1");

    expect(
      await screen.findByText("新しいパスワードは現在のパスワードと異なるものにしてください"),
    ).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("shows a weak-password message when Supabase Auth returns the weak_password error code", async () => {
    updateUser.mockResolvedValue({
      data: null,
      error: { name: "AuthApiError", message: "Password is too weak", code: "weak_password" },
    });
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "newpassword1", "newpassword1");

    expect(
      await screen.findByText("パスワードの強度が不足しています。別のパスワードを入力してください"),
    ).toBeInTheDocument();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("disables the submit button while updating", async () => {
    let resolveUpdate: (value: { data: unknown; error: null }) => void = () => {};
    updateUser.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<UpdatePasswordForm />);

    await fillAndSubmit(user, "newpassword1", "newpassword1");

    expect(await screen.findByRole("button", { name: "更新中..." })).toBeDisabled();

    resolveUpdate({ data: { user: {} }, error: null });
    await screen.findByRole("status");
  });
});
