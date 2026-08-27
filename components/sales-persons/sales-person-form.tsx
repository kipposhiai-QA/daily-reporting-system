"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ApiClientError, apiClient } from "@/lib/api-client";
import type { SalesPersonBody, SalesPersonResponse } from "@/lib/api/schemas/sales-person";

type SalesPersonFormProps =
  { mode: "create"; salesPersonId?: undefined } | { mode: "edit"; salesPersonId: string };

export function SalesPersonForm(props: SalesPersonFormProps) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [isManager, setIsManager] = useState(false);

  const [isInitializing, setIsInitializing] = useState(props.mode === "edit");
  const [initError, setInitError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (props.mode !== "edit") return;

    let cancelled = false;

    apiClient
      .get<SalesPersonResponse>(`/sales-persons/${props.salesPersonId}`)
      .then((salesPerson) => {
        if (cancelled) return;
        setName(salesPerson.name);
        setEmail(salesPerson.email);
        setDepartment(salesPerson.department ?? "");
        setIsManager(salesPerson.is_manager);
      })
      .catch((error) => {
        if (cancelled) return;
        setInitError(
          error instanceof ApiClientError && error.status === 404
            ? "指定された営業担当者が見つかりません"
            : "データの取得に失敗しました",
        );
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (props.mode === "create") {
        await apiClient.post<SalesPersonResponse>("/sales-persons", body);
      } else {
        await apiClient.put<SalesPersonResponse>(`/sales-persons/${props.salesPersonId}`, body);
      }
      router.push("/sales-persons");
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (props.mode !== "edit") return;

    setDeleteError(null);
    setIsDeleting(true);
    try {
      await apiClient.delete(`/sales-persons/${props.salesPersonId}`);
      router.push("/sales-persons");
    } catch (error) {
      setDeleteError(error instanceof ApiClientError ? error.message : "削除に失敗しました");
      setIsDeleteDialogOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }

  if (isInitializing) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8">
        読み込み中...
      </div>
    );
  }

  if (initError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-destructive">{initError}</p>
        <Button asChild variant="outline">
          <Link href="/sales-persons">営業マスタ一覧へ戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">営業担当者登録・編集</h1>

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="sales-person-name">氏名＊</FieldLabel>
          <Input
            id="sales-person-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sales-person-email">メールアドレス＊</FieldLabel>
          <Input
            id="sales-person-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="sales-person-department">部署</FieldLabel>
          <Input
            id="sales-person-department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
          />
        </Field>
        <label htmlFor="sales-person-is-manager" className="flex items-center gap-2 text-sm">
          <Checkbox
            id="sales-person-is-manager"
            checked={isManager}
            onCheckedChange={(checked) => setIsManager(checked === true)}
          />
          上長として登録する
        </label>

        {formError && <p className="text-destructive text-sm">{formError}</p>}
        {deleteError && <p className="text-destructive text-sm">{deleteError}</p>}

        <div className="flex items-center justify-between gap-3">
          <div>
            {props.mode === "edit" && (
              <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="destructive">
                    削除
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>営業担当者の削除</DialogTitle>
                    <DialogDescription>
                      この営業担当者を削除します。よろしいですか？この操作は取り消せません。
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsDeleteDialogOpen(false)}
                    >
                      キャンセル
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isDeleting}
                      onClick={handleDelete}
                    >
                      削除する
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" asChild>
              <Link href="/sales-persons">キャンセル</Link>
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              保存
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
