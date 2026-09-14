"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReportListItemResponse } from "@/lib/api/schemas/report";
import { apiClient } from "@/lib/api-client";
import { useCurrentUser } from "@/lib/current-user-context";

const STATUS_LABEL: Record<ReportListItemResponse["status"], string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
};

/** 営業担当者フィルタの「全員」を表すSelectの値。空文字はRadix Selectで未選択と区別できないため使う。 */
const ALL_SALES_PERSONS_VALUE = "all";

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  salesPersonId: string;
}

const EMPTY_FILTERS: ReportFilters = { dateFrom: "", dateTo: "", salesPersonId: "" };

function buildReportsQuery(filters: ReportFilters, isManager: boolean): string {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("date_from", filters.dateFrom);
  if (filters.dateTo) params.set("date_to", filters.dateTo);
  if (isManager && filters.salesPersonId) params.set("sales_person_id", filters.salesPersonId);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export default function ReportListPage() {
  const router = useRouter();
  const { salesPersons, isManager, isLoading: isUserLoading, currentUser } = useCurrentUser();

  const [draftFilters, setDraftFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [reports, setReports] = useState<ReportListItemResponse[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  // 直近に完了したリクエストのキー。現在のリクエストキーと一致しない間は「読み込み中」とみなす
  // （effect内で同期的にsetStateして読み込みフラグを立てるのは react-hooks/set-state-in-effect に
  // 抵触するため、完了済みリクエストとの差分から描画時に導出する）。
  const [completedRequestKey, setCompletedRequestKey] = useState<string | null>(null);

  const requestKey = JSON.stringify({
    appliedFilters,
    isManager,
    salesPersonId: currentUser?.sales_person_id,
  });
  const isLoadingReports = currentUser !== null && completedRequestKey !== requestKey;

  useEffect(() => {
    if (isUserLoading || !currentUser) return;

    let cancelled = false;
    const key = requestKey;

    apiClient
      .get<ReportListItemResponse[]>(`/reports${buildReportsQuery(appliedFilters, isManager)}`)
      .then((data) => {
        if (cancelled) return;
        setReports(data);
        setLoadError(null);
        setCompletedRequestKey(key);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("日報一覧の取得に失敗しました");
        setCompletedRequestKey(key);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, isUserLoading, currentUser]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAppliedFilters(draftFilters);
  }

  function goToDetail(reportId: number) {
    router.push(`/reports/${reportId}`);
  }

  if (isUserLoading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8">
        読み込み中...
      </div>
    );
  }

  const columnCount = isManager ? 4 : 3;

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">日報一覧</h1>
        <Button asChild>
          <Link href="/reports/new">＋新規作成</Link>
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-medium">対象日</span>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              className="w-40"
              aria-label="対象日（開始）"
              value={draftFilters.dateFrom}
              onChange={(event) =>
                setDraftFilters((filters) => ({ ...filters, dateFrom: event.target.value }))
              }
            />
            <span className="text-muted-foreground">〜</span>
            <Input
              type="date"
              className="w-40"
              aria-label="対象日（終了）"
              value={draftFilters.dateTo}
              onChange={(event) =>
                setDraftFilters((filters) => ({ ...filters, dateTo: event.target.value }))
              }
            />
          </div>
        </div>

        {isManager && (
          <div className="flex flex-col gap-1">
            <label htmlFor="sales-person-filter" className="text-sm font-medium">
              営業担当者
            </label>
            <Select
              value={draftFilters.salesPersonId || ALL_SALES_PERSONS_VALUE}
              onValueChange={(value) =>
                setDraftFilters((filters) => ({
                  ...filters,
                  salesPersonId: value === ALL_SALES_PERSONS_VALUE ? "" : value,
                }))
              }
            >
              <SelectTrigger id="sales-person-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_SALES_PERSONS_VALUE}>全員</SelectItem>
                {salesPersons.map((person) => (
                  <SelectItem key={person.sales_person_id} value={String(person.sales_person_id)}>
                    {person.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button type="submit">検索</Button>
      </form>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              {isManager && <TableHead>営業担当者</TableHead>}
              <TableHead>ステータス</TableHead>
              <TableHead>訪問件数</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingReports ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-muted-foreground text-center">
                  読み込み中...
                </TableCell>
              </TableRow>
            ) : loadError ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-destructive text-center">
                  {loadError}
                </TableCell>
              </TableRow>
            ) : reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} className="text-muted-foreground text-center">
                  データがありません
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow
                  key={report.report_id}
                  tabIndex={0}
                  onClick={() => goToDetail(report.report_id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") goToDetail(report.report_id);
                  }}
                  className="cursor-pointer"
                >
                  <TableCell>{report.report_date}</TableCell>
                  {isManager && <TableCell>{report.sales_person_name}</TableCell>}
                  <TableCell>
                    <Badge variant={report.status === "SUBMITTED" ? "default" : "secondary"}>
                      {STATUS_LABEL[report.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{report.visit_count}件</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
