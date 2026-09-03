"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useCurrentUser } from "@/lib/current-user-context";
import { createClient } from "@/lib/supabase/client";

/**
 * ログイン画面。Supabase Auth (signInWithPassword) に接続し、
 * 成功時はトップページへ遷移、失敗時はフォーム上にエラーを表示する。
 */
export function LoginForm() {
  const router = useRouter();
  const { refresh } = useCurrentUser();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("メールアドレスを入力してください");
      return;
    }
    if (!password) {
      setFormError("パスワードを入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setFormError("メールアドレスまたはパスワードが正しくありません");
        return;
      }

      // ヘッダーの「現在のユーザー」表示（lib/current-user-context.tsx）は初回マウント時にのみ
      // GET /api/auth/me を取得するクライアントサイドの状態のため、router.pushだけではログイン
      // 後の状態が反映されない。refresh()で明示的に再取得してから遷移する（Issue #66）。
      await refresh();
      router.refresh();
      router.push("/");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold">営業日報システム</h1>
          <p className="text-muted-foreground text-sm">
            メールアドレスとパスワードでログインしてください
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="login-email">メールアドレス</FieldLabel>
            <Input
              id="login-email"
              type="email"
              placeholder="admin@system.com"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="login-password">パスワード</FieldLabel>
            <div className="relative">
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="pr-9"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="absolute top-1/2 right-1 -translate-y-1/2"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "パスワードを隠す" : "パスワードを表示する"}
              >
                {showPassword ? (
                  <EyeOffIcon aria-hidden="true" className="size-4" />
                ) : (
                  <EyeIcon aria-hidden="true" className="size-4" />
                )}
              </Button>
            </div>
          </Field>

          {formError && (
            <p className="text-destructive text-sm" role="alert">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? "ログイン中..." : "ログイン"}
          </Button>
        </form>

        <Link
          href="/reset-password"
          className="text-muted-foreground text-center text-sm hover:underline"
        >
          パスワードを忘れた方
        </Link>

        <div className="text-muted-foreground rounded-lg border p-3 text-center text-xs">
          <p>テスト用アカウント:</p>
          <p>メール: yamada@example.com</p>
          <p>パスワード: password123</p>
        </div>

        <Link href="/" className="text-primary text-center text-sm font-medium hover:underline">
          トップに戻る
        </Link>
      </div>
    </div>
  );
}
