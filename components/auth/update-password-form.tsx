"use client";

import type { AuthError } from "@supabase/supabase-js";
import Link from "next/link";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 6;

const LINK_EXPIRED_MESSAGE =
  "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。もう一度パスワード再設定をお試しください";

/**
 * updateUser()のエラーコード別に表示メッセージを出し分ける（参照: Issue #76）。
 * same_password・weak_password はセッション自体は有効な入力値エラーのため、
 * リンク期限切れではなくパスワードの再入力を促すメッセージにする。
 * それ以外（セッション/リンク自体が無効な場合を含む）は従来通りのメッセージにフォールバックする。
 */
function getUpdatePasswordErrorMessage(error: AuthError): string {
  switch (error.code) {
    case "same_password":
      return "新しいパスワードは現在のパスワードと異なるものにしてください";
    case "weak_password":
      return "パスワードの強度が不足しています。別のパスワードを入力してください";
    default:
      return LINK_EXPIRED_MESSAGE;
  }
}

/**
 * 新パスワード設定画面。パスワードリセットメール内のリンクから遷移する
 * （リンク経由でSupabase Authの回復セッションがブラウザに確立されている前提）。
 * 新パスワードをsupabase.auth.updateUser()で設定し、以後は改めてログインしてもらうため
 * 回復セッションはsignOut()で破棄する。参照: Issue #72
 */
export function UpdatePasswordForm() {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdated, setIsUpdated] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!password) {
      setFormError("新しいパスワードを入力してください");
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setFormError(`パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください`);
      return;
    }
    if (password !== passwordConfirmation) {
      setFormError("パスワードが一致しません");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setFormError(getUpdatePasswordErrorMessage(error));
        return;
      }

      await supabase.auth.signOut();
      setIsUpdated(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col gap-1 text-center">
          <h1 className="text-2xl font-bold">新しいパスワードの設定</h1>
        </div>

        {isUpdated ? (
          <>
            <p className="text-sm" role="status">
              パスワードを更新しました。新しいパスワードでログインしてください
            </p>
            <Link
              href="/login"
              className="text-primary text-center text-sm font-medium hover:underline"
            >
              ログイン画面へ
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="update-password-password">新しいパスワード</FieldLabel>
              <Input
                id="update-password-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="update-password-confirmation">
                新しいパスワード（確認）
              </FieldLabel>
              <Input
                id="update-password-confirmation"
                type="password"
                autoComplete="new-password"
                value={passwordConfirmation}
                onChange={(event) => setPasswordConfirmation(event.target.value)}
              />
            </Field>

            {formError && (
              <p className="text-destructive text-sm" role="alert">
                {formError}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "更新中..." : "パスワードを更新"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
