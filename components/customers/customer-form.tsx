"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import type { CustomerBody, CustomerResponse } from "@/lib/api/schemas/customer";

type CustomerFormProps =
  { mode: "create"; customerId?: undefined } | { mode: "edit"; customerId: string };

export function CustomerForm(props: CustomerFormProps) {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

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
      .get<CustomerResponse>(`/customers/${props.customerId}`)
      .then((customer) => {
        if (cancelled) return;
        setCompanyName(customer.company_name);
        setContactPerson(customer.contact_person ?? "");
        setPhone(customer.phone ?? "");
        setEmail(customer.email ?? "");
        setAddress(customer.address ?? "");
      })
      .catch((error) => {
        if (cancelled) return;
        setInitError(
          error instanceof ApiClientError && error.status === 404
            ? "指定された顧客が見つかりません"
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

    if (!companyName.trim()) {
      setFormError("会社名を入力してください");
      return;
    }

    const body: CustomerBody = {
      company_name: companyName.trim(),
      contact_person: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
    };

    setIsSubmitting(true);
    try {
      if (props.mode === "create") {
        await apiClient.post<CustomerResponse>("/customers", body);
      } else {
        await apiClient.put<CustomerResponse>(`/customers/${props.customerId}`, body);
      }
      router.push("/customers");
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
      await apiClient.delete(`/customers/${props.customerId}`);
      router.push("/customers");
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
          <Link href="/customers">顧客マスタ一覧へ戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">顧客登録・編集</h1>

      <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
        <Field>
          <FieldLabel htmlFor="customer-company-name">会社名＊</FieldLabel>
          <Input
            id="customer-company-name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            maxLength={200}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="customer-contact-person">担当者名</FieldLabel>
          <Input
            id="customer-contact-person"
            value={contactPerson}
            onChange={(event) => setContactPerson(event.target.value)}
            maxLength={50}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="customer-phone">電話番号</FieldLabel>
          <Input
            id="customer-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            maxLength={20}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="customer-email">メールアドレス</FieldLabel>
          <Input
            id="customer-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={254}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="customer-address">住所</FieldLabel>
          <Input
            id="customer-address"
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            maxLength={200}
          />
        </Field>

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
                    <DialogTitle>顧客の削除</DialogTitle>
                    <DialogDescription>
                      この顧客を削除します。よろしいですか？この操作は取り消せません。
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
              <Link href="/customers">キャンセル</Link>
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
