import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/client";
import { LoginForm } from "./login-form";

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

const signInWithPassword = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

const createClientMock = vi.mocked(createClient);

beforeEach(() => {
  push.mockReset();
  signInWithPassword.mockReset();
  createClientMock.mockReset();
  createClientMock.mockReturnValue({
    auth: { signInWithPassword },
  } as unknown as ReturnType<typeof createClient>);
});

describe("LoginForm", () => {
  it("renders the email and password fields", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText("メールアドレス")).toBeInTheDocument();
    expect(screen.getByLabelText("パスワード")).toHaveAttribute("type", "password");
    expect(screen.getByText("テスト用アカウント:")).toBeInTheDocument();
  });

  it("links back to the top page", () => {
    render(<LoginForm />);

    expect(screen.getByRole("link", { name: "トップに戻る" })).toHaveAttribute("href", "/");
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    const passwordInput = screen.getByLabelText("パスワード");
    expect(passwordInput).toHaveAttribute("type", "password");

    await user.click(screen.getByRole("button", { name: "パスワードを表示する" }));
    expect(passwordInput).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "パスワードを隠す" }));
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("rejects submission when the email is empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("メールアドレスを入力してください")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects submission when the password is empty", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByText("パスワードを入力してください")).toBeInTheDocument();
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in with Supabase Auth and redirects to the top page on success (TC-SCR-LOGIN-01)", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: {}, session: {} }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "yamada@example.com",
      password: "password123",
    });
  });

  it("shows an error message when Supabase Auth rejects the credentials (TC-SCR-LOGIN-02)", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { name: "AuthApiError", message: "Invalid login credentials" },
    });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.type(screen.getByLabelText("パスワード"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(
      await screen.findByText("メールアドレスまたはパスワードが正しくありません"),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "メールアドレスまたはパスワードが正しくありません",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the submit button while signing in", async () => {
    let resolveSignIn: (value: { data: unknown; error: null }) => void = () => {};
    signInWithPassword.mockReturnValue(
      new Promise((resolve) => {
        resolveSignIn = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.type(screen.getByLabelText("メールアドレス"), "yamada@example.com");
    await user.type(screen.getByLabelText("パスワード"), "password123");
    await user.click(screen.getByRole("button", { name: "ログイン" }));

    expect(await screen.findByRole("button", { name: "ログイン中..." })).toBeDisabled();

    resolveSignIn({ data: { user: {}, session: {} }, error: null });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/"));
  });
});
