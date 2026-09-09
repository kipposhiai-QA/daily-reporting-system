"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { ApiClientError, apiClient } from "@/lib/api-client";
import type { CommentResponse } from "@/lib/api/schemas/comment";
import type { ReportDetailResponse } from "@/lib/api/schemas/report";
import { useCurrentUser } from "@/lib/current-user-context";

const STATUS_LABEL: Record<ReportDetailResponse["status"], string> = {
  DRAFT: "下書き",
  SUBMITTED: "提出済み",
};

/** "2026-08-25T19:10:00+09:00" のようなISO8601日時を "08/25 19:10" 形式に整形する（表示専用）。 */
function formatCommentTimestamp(isoDateTime: string): string {
  const match = isoDateTime.match(/^\d{4}-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return isoDateTime;
  const [, month, day, hour, minute] = match;
  return `${month}/${day} ${hour}:${minute}`;
}

interface ReportDetailProps {
  reportId: string;
}

export function ReportDetail({ reportId }: ReportDetailProps) {
  const { isLoading: isUserLoading, currentUser, isManager } = useCurrentUser();

  const [report, setReport] = useState<ReportDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isPostingComment, setIsPostingComment] = useState(false);

  useEffect(() => {
    if (isUserLoading || !currentUser) return;

    let cancelled = false;

    apiClient
      .get<ReportDetailResponse>(`/reports/${reportId}`)
      .then((data) => {
        if (cancelled) return;
        setReport(data);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) return;
        if (error instanceof ApiClientError && (error.status === 403 || error.status === 404)) {
          setLoadError(
            error.status === 404
              ? "指定された日報が見つかりません"
              : "この日報にアクセスする権限がありません",
          );
        } else {
          setLoadError("日報の取得に失敗しました");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reportId, isUserLoading, currentUser]);

  async function handlePostComment() {
    const trimmed = commentText.trim();
    if (!trimmed) {
      setCommentError("コメントを入力してください");
      return;
    }

    setCommentError(null);
    setIsPostingComment(true);
    try {
      const created = await apiClient.post<CommentResponse>(`/reports/${reportId}/comments`, {
        comment: trimmed,
      });
      setReport((current) =>
        current ? { ...current, comments: [...current.comments, created] } : current,
      );
      setCommentText("");
    } catch (error) {
      setCommentError(
        error instanceof ApiClientError ? error.message : "コメントの投稿に失敗しました",
      );
    } finally {
      setIsPostingComment(false);
    }
  }

  if (isUserLoading || isLoading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center p-8">
        読み込み中...
      </div>
    );
  }

  if (loadError || !report) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <p className="text-destructive">{loadError ?? "日報の取得に失敗しました"}</p>
        <Button asChild variant="outline">
          <Link href="/reports">日報一覧へ戻る</Link>
        </Button>
      </div>
    );
  }

  const isOwner = currentUser?.sales_person_id === report.sales_person_id;

  return (
    <div className="flex flex-col gap-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold">日報詳細</h1>
          <span className="text-muted-foreground text-sm">
            {report.report_date} / {report.sales_person_name}
          </span>
          <Badge variant={report.status === "SUBMITTED" ? "default" : "secondary"}>
            {STATUS_LABEL[report.status]}
          </Badge>
        </div>
        {isOwner && (
          <Button asChild variant="outline">
            <Link href={`/reports/${report.report_id}/edit`}>編集</Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">訪問記録</h2>
        {report.visit_records.length === 0 ? (
          <p className="text-muted-foreground text-sm">訪問記録はありません</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {report.visit_records.map((visit) => (
              <li key={visit.visit_id} className="text-sm">
                ・{visit.visit_time ? `${visit.visit_time} ` : ""}
                {visit.customer_name} — {visit.visit_content}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Problem</h2>
        <p className="text-sm whitespace-pre-wrap">{report.problem || "（記載なし）"}</p>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Plan</h2>
        <p className="text-sm whitespace-pre-wrap">{report.plan || "（記載なし）"}</p>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium">コメント</h2>
        {report.comments.length === 0 ? (
          <p className="text-muted-foreground text-sm">コメントはありません</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {report.comments.map((comment) => (
              <li key={comment.comment_id} className="text-sm">
                [{formatCommentTimestamp(comment.created_at)}] {comment.manager_name}：
                {comment.comment}
              </li>
            ))}
          </ul>
        )}

        {isManager && (
          <div className="flex flex-col gap-2">
            <Textarea
              aria-label="コメント入力欄"
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              maxLength={1000}
            />
            {commentError && <p className="text-destructive text-sm">{commentError}</p>}
            <Button
              type="button"
              className="w-fit self-end"
              disabled={isPostingComment}
              onClick={handlePostComment}
            >
              投稿
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
