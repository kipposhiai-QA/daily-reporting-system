"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

/**
 * パスワードリセット申請画面。Supabase Auth (resetPasswordForEmail) にメールアドレスを送信し、
 * リセットメール内のリンク（/reset-password/confirm）から新パスワードを設定できるようにする。
 * 参照: Issue #72
 */
export function ResetPasswordRequestForm() {
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!email.trim()) {
      setFormError("メールアドレスを入力してください");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password/confirm`,
      });

      if (error) {
        setFormError("メールの送信に失敗しました。時間をおいて再度お試しください");
        return;
      }

      setIsSent(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold">パスワードの再設定</h1>
          <p className="text-muted-foreground text-sm">
            登録済みのメールアドレスを入力してください。パスワード再設定用のリンクをお送りします
          </p>
        </div>

        {isSent ? (
          <p className="text-sm" role="status">
            パスワード再設定用のメールを送信しました。メール内のリンクから新しいパスワードを設定してください
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="reset-password-email">メールアドレス</FieldLabel>
              <Input
                id="reset-password-email"
                type="email"
                placeholder="admin@system.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            {formError && (
              <p className="text-destructive text-sm" role="alert">
                {formError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "送信中..." : "リセットメールを送信"}
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="text-primary text-center text-sm font-medium hover:underline"
        >
          ログイン画面に戻る
        </Link>
      </div>
    </div>
  );
}
