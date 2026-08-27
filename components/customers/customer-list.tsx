"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/lib/api-client";
import type { CustomerResponse } from "@/lib/api/schemas/customer";
import { useCurrentUser } from "@/lib/current-user-context";

function buildCustomersQuery(companyName: string): string {
  const params = new URLSearchParams();
  if (companyName) params.set("company_name", companyName);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function CustomerList() {
  const router = useRouter();
  const { isLoading: isUserLoading, currentUser } = useCurrentUser();

  const [draftCompanyName, setDraftCompanyName] = useState("");
  const [appliedCompanyName, setAppliedCompanyName] = useState("");
  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 直近に完了したリクエストのキー。現在のリクエストキーと一致しない間は「読み込み中」とみなす
  // （effect内で同期的にsetStateして読み込みフラグを立てるのは react-hooks/set-state-in-effect に
  // 抵触するため、完了済みリクエストとの差分から描画時に導出する）。
  const [completedRequestKey, setCompletedRequestKey] = useState<string | null>(null);

  const requestKey = appliedCompanyName;
  const isLoadingCustomers = currentUser !== null && completedRequestKey !== requestKey;

  useEffect(() => {
    if (isUserLoading || !currentUser) return;

    let cancelled = false;
    const key = requestKey;

    apiClient
      .get<CustomerResponse[]>(`/customers${buildCustomersQuery(appliedCompanyName)}`)
      .then((data) => {
        if (cancelled) return;
        setCustomers(data);
        setLoadError(null);
        setCompletedRequestKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("顧客一覧の取得に失敗しました");
        setCompletedRequestKey(key);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, isUserLoading, currentUser]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedCompanyName(draftCompanyName);
  }

  function goToEdit(customerId: number) {
    router.push(`/customers/${customerId}/edit`);
  }

  if (isUserLoading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">顧客マスタ</h1>
        <Button asChild>
          <Link href="/customers/new">＋新規登録</Link>
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="company-name-filter" className="text-sm font-medium">
            会社名
          </label>
          <Input
            id="company-name-filter"
            className="w-56"
            value={draftCompanyName}
            onChange={(event) => setDraftCompanyName(event.target.value)}
          />
        </div>
        <Button type="submit">検索</Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>会社名</TableHead>
              <TableHead>担当者名</TableHead>
              <TableHead>電話番号</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingCustomers ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={3} className="text-destructive text-center">
                  {loadError}
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-muted-foreground text-center">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow
                  key={customer.customer_id}
                  tabIndex={0}
                  onClick={() => goToEdit(customer.customer_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") goToEdit(customer.customer_id);
                  }}
                  className="cursor-pointer"
                >
                  <TableCell>{customer.company_name}</TableCell>
                  <TableCell>{customer.contact_person ?? ""}</TableCell>
                  <TableCell>{customer.phone ?? ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
