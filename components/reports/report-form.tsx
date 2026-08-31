"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiClient } from "@/lib/api-client";
import type { CustomerResponse } from "@/lib/api/schemas/customer";
import type { ReportBody, ReportDetailResponse } from "@/lib/api/schemas/report";
import { useCurrentUser } from "@/lib/current-user-context";

interface VisitRow {
  key: number;
  customerId: string;
  visitContent: string;
  visitTime: string;
}

function emptyRow(key: number): VisitRow {
  return { key, customerId: "", visitContent: "", visitTime: "" };
}

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

interface BuildVisitRecordsResult {
  records: ReportBody["visit_records"];
  errors: string[];
}

/** 完全に空の行は無視し、片方だけ入力された行はエラーとして報告する。 */
function buildVisitRecords(rows: VisitRow[]): BuildVisitRecordsResult {
  const records: ReportBody["visit_records"] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const hasCustomer = row.customerId !== "";
    const hasContent = row.visitContent.trim() !== "";
    if (!hasCustomer && !hasContent) return;
    if (!hasCustomer || !hasContent) {
      errors.push(`訪問記録${index + 1}行目: 顧客と訪問内容の両方を入力してください`);
      return;
    }
    records.push({
      customer_id: Number(row.customerId),
      visit_content: row.visitContent.trim(),
      ...(row.visitTime ? { visit_time: row.visitTime } : {}),
    });
  });

  return { records, errors };
}

type ReportFormProps =
  { mode: "create"; reportId?: undefined } | { mode: "edit"; reportId: string };

const UNSAVED_CHANGES_CONFIRM_MESSAGE =
  "保存されていない変更があります。ユーザーを切り替えると入力内容は破棄されます。切り替えますか？";

interface FormSnapshot {
  reportDate: string;
  problem: string;
  plan: string;
  visitRows: VisitRow[];
}

function isSameVisitRows(a: VisitRow[], b: VisitRow[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((row, index) => {
    const other = b[index];
    return (
      row.customerId === other.customerId &&
      row.visitContent === other.visitContent &&
      row.visitTime === other.visitTime
    );
  });
}

export function ReportForm(props: ReportFormProps) {
  const router = useRouter();
  const { isLoading: isUserLoading, currentUser, selectSalesPersonId } = useCurrentUser();

  const [customers, setCustomers] = useState<CustomerResponse[]>([]);
  const [reportDate, setReportDate] = useState(getTodayDateString());
  const [problem, setProblem] = useState("");
  const [plan, setPlan] = useState("");
  const [visitRows, setVisitRows] = useState<VisitRow[]>([]);
  const nextRowKey = useRef(0);

  const [isInitializing, setIsInitializing] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 直近に読み込んだ（＝未編集とみなす）内容のスナップショット。
  // 初期値はマウント時点のデフォルト値（新規作成時の空フォーム相当）。
  const loadedSnapshotRef = useRef<FormSnapshot>({
    reportDate,
    problem,
    plan,
    visitRows,
  });
  const prevSalesPersonIdRef = useRef<number | null>(null);
  const skipNextLoadRef = useRef(false);

  function hasUnsavedChanges(): boolean {
    const snapshot = loadedSnapshotRef.current;
    return (
      reportDate !== snapshot.reportDate ||
      problem !== snapshot.problem ||
      plan !== snapshot.plan ||
      !isSameVisitRows(visitRows, snapshot.visitRows)
    );
  }

  useEffect(() => {
    if (isUserLoading || !currentUser) return;

    const previousSalesPersonId = prevSalesPersonIdRef.current;
    const isUserSwitch =
      previousSalesPersonId !== null && previousSalesPersonId !== currentUser.sales_person_id;
    // 編集画面のみ、切替に伴う再読み込みで入力中の内容が上書き・破棄されうる
    // （新規作成画面は切替時にフォーム内容を書き換えないため対象外）。
    const wouldDiscardChanges = isUserSwitch && props.mode === "edit" && hasUnsavedChanges();

    if (wouldDiscardChanges) {
      const confirmed = window.confirm(UNSAVED_CHANGES_CONFIRM_MESSAGE);
      if (!confirmed) {
        // ユーザー切替をキャンセルし、直前のユーザーへ戻す。フォームの内容は保持したまま
        // 再読み込みをスキップする（下のeffect再実行で入力内容が破棄されないようにする）。
        skipNextLoadRef.current = true;
        selectSalesPersonId(previousSalesPersonId);
        return;
      }
    }

    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      prevSalesPersonIdRef.current = currentUser.sales_person_id;
      return;
    }

    prevSalesPersonIdRef.current = currentUser.sales_person_id;

    let cancelled = false;

    async function load() {
      try {
        const customerList = await apiClient.get<CustomerResponse[]>("/customers");
        if (cancelled) return;
        setCustomers(customerList);

        if (props.mode === "edit") {
          const report = await apiClient.get<ReportDetailResponse>(`/reports/${props.reportId}`);
          if (cancelled) return;

          if (report.sales_person_id !== currentUser!.sales_person_id) {
            setInitError("この日報を編集する権限がありません");
            return;
          }

          const loadedVisitRows = report.visit_records.map((visit) => ({
            key: nextRowKey.current++,
            customerId: String(visit.customer_id),
            visitContent: visit.visit_content,
            visitTime: visit.visit_time ?? "",
          }));

          setReportDate(report.report_date);
          setProblem(report.problem ?? "");
          setPlan(report.plan ?? "");
          setVisitRows(loadedVisitRows);

          loadedSnapshotRef.current = {
            reportDate: report.report_date,
            problem: report.problem ?? "",
            plan: report.plan ?? "",
            visitRows: loadedVisitRows,
          };
        }
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiClientError && (error.status === 403 || error.status === 404)) {
          setInitError(
            error.status === 404
              ? "指定された日報が見つかりません"
              : "この日報を編集する権限がありません",
          );
        } else {
          setInitError("データの取得に失敗しました");
        }
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoading, currentUser]);

  function addRow() {
    setVisitRows((rows) => [...rows, emptyRow(nextRowKey.current++)]);
  }

  function removeRow(key: number) {
    setVisitRows((rows) => rows.filter((row) => row.key !== key));
  }

  function updateRow(key: number, patch: Partial<Omit<VisitRow, "key">>) {
    setVisitRows((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  async function handleSubmit(status: "DRAFT" | "SUBMITTED") {
    setFormError(null);

    if (!reportDate) {
      setFormError("対象日を入力してください");
      return;
    }

    const { records, errors } = buildVisitRecords(visitRows);
    if (errors.length > 0) {
      setFormError(errors.join(" / "));
      return;
    }
    if (status === "SUBMITTED" && records.length === 0) {
      setFormError("提出するには訪問記録を1件以上入力してください");
      return;
    }

    const body: ReportBody = {
      report_date: reportDate,
      status,
      problem: problem.trim() || null,
      plan: plan.trim() || null,
      visit_records: records,
    };

    setIsSubmitting(true);
    try {
      if (props.mode === "create") {
        await apiClient.post<ReportDetailResponse>("/reports", body);
        router.push("/reports");
      } else {
        const updated = await apiClient.put<ReportDetailResponse>(
          `/reports/${props.reportId}`,
          body,
        );
        router.push(`/reports/${updated.report_id}`);
      }
    } catch (error) {
      setFormError(error instanceof ApiClientError ? error.message : "保存に失敗しました");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isUserLoading || isInitializing) {
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
          <Link href="/reports">日報一覧へ戻る</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="text-xl font-semibold">日報作成・編集</h1>

      <Field className="max-w-xs">
        <FieldLabel htmlFor="report-date">対象日</FieldLabel>
        <Input
          id="report-date"
          type="date"
          required
          value={reportDate}
          onChange={(event) => setReportDate(event.target.value)}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">訪問記録</span>

        {visitRows.length > 0 && (
          <div className="flex flex-col gap-3 md:gap-2">
            <div className="hidden grid-cols-[1fr_2fr_140px_40px] gap-2 text-sm font-medium md:grid">
              <span>顧客</span>
              <span>訪問内容</span>
              <span>訪問時刻</span>
              <span />
            </div>
            {visitRows.map((row) => (
              <div
                key={row.key}
                className="flex flex-col gap-2 rounded-lg border p-3 md:grid md:grid-cols-[1fr_2fr_140px_40px] md:items-start md:gap-2 md:rounded-none md:border-0 md:p-0"
              >
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium md:hidden">顧客</span>
                  <Select
                    value={row.customerId}
                    onValueChange={(value) => updateRow(row.key, { customerId: value })}
                  >
                    <SelectTrigger aria-label={`訪問記録の顧客`} className="w-full">
                      <SelectValue placeholder="顧客を選択" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((customer) => (
                        <SelectItem key={customer.customer_id} value={String(customer.customer_id)}>
                          {customer.company_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium md:hidden">訪問内容</span>
                  <Textarea
                    aria-label="訪問内容"
                    rows={1}
                    value={row.visitContent}
                    onChange={(event) => updateRow(row.key, { visitContent: event.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-medium md:hidden">訪問時刻</span>
                  <Input
                    type="time"
                    aria-label="訪問時刻"
                    value={row.visitTime}
                    onChange={(event) => updateRow(row.key, { visitTime: event.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="この訪問記録を削除"
                  onClick={() => removeRow(row.key)}
                  className="self-end md:self-start"
                >
                  ×
                </Button>
              </div>
            ))}
          </div>
        )}

        <Button type="button" variant="outline" className="w-fit" onClick={addRow}>
          ＋訪問記録を追加
        </Button>
      </div>

      <Field>
        <FieldLabel htmlFor="report-problem">Problem（課題・相談）</FieldLabel>
        <Textarea
          id="report-problem"
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="report-plan">Plan（明日やること）</FieldLabel>
        <Textarea id="report-plan" value={plan} onChange={(event) => setPlan(event.target.value)} />
      </Field>

      {formError && (
        <p className="text-destructive text-sm" role="alert">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={isSubmitting}
          onClick={() => handleSubmit("DRAFT")}
        >
          下書き保存
        </Button>
        <Button type="button" disabled={isSubmitting} onClick={() => handleSubmit("SUBMITTED")}>
          提出する
        </Button>
      </div>
    </div>
  );
}
