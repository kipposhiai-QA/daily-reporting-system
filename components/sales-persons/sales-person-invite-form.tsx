"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiClient } from "@/lib/api-client";
import type { SalesPersonBody, SalesPersonResponse } from "@/lib/api/schemas/sales-person";

/**
 * 新規担当者の招待フォーム。SalesPersonレコードの作成とSupabase Auth招待メールの送信を
 * 1つのAPI呼び出し(POST /api/sales-persons/invite)で行う。参照: Issue #74
 */
export function SalesPersonInviteForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [isManager, setIsManager] = useState(false);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    if (!name.trim()) {
      setFormError("氏名を入力してください");
      return;
    }
    if (!email.trim()) {
      setFormError("メールアドレスを入力してください");
      return;
    }

    const body: SalesPersonBody = {
      name: name.trim(),
      email: email.trim(),
      department: department.trim() || null,
      is_manager: isManager,
    };

    setIsSubmitting(true);
    try {
      await apiClient.post<SalesPersonResponse>("/sales-persons/invite", body);
      router.push("/sales-persons");
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "招待に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">新規担当者の招待</h1>
        <p className="text-muted-foreground text-sm">
          入力したメールアドレス宛に招待メールが送信されます。招待された担当者はメール内のリンクから初回パスワードを設定できます
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="sales-person-invite-name">氏名＊</FieldLabel>
          <Input
            id="sales-person-invite-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={50}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sales-person-invite-email">メールアドレス＊</FieldLabel>
          <Input
            id="sales-person-invite-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sales-person-invite-department">部署</FieldLabel>
          <Input
            id="sales-person-invite-department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            maxLength={100}
          />
        </Field>
        <label htmlFor="sales-person-invite-is-manager" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="sales-person-invite-is-manager"
            checked={isManager}
            onCheckedChange={(checked) => setIsManager(checked === true)}
          />
          上長として登録する
        </label>

        {formError && (
          <p className="text-destructive text-sm" role="alert">
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" asChild>
            <Link href="/sales-persons">キャンセル</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "招待中..." : "招待する"}
          </Button>
        </div>
      </form>
    </div>
  );
}
