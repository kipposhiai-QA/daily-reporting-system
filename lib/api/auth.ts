// APIルートの現在ユーザー解決。
// 参照: Issue #78（X-Sales-Person-Id ヘッダーをクライアントが自由に偽装できる問題への対応）
//
// 移行中は2つの解決方式が並存する。
// - getCurrentSalesPersonFromSession: Supabase Authのログインセッション（cookie）を検証して
//   解決する新方式。reports/comments（Stage 1/3）、sales-persons（Stage 2/3）から移行済み。
// - getCurrentSalesPerson: 旧来の X-Sales-Person-Id ヘッダーをそのまま信頼する方式
//   （docs/api-specification.md 1.2 「認証代替」）。customers系ルートがStage 3/3で
//   移行するまでの間、暫定的に残す。移行完了後は削除する。
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { ApiError } from "./errors";

export const SALES_PERSON_ID_HEADER = "x-sales-person-id";

export interface CurrentSalesPerson {
  salesPersonId: number;
  isManager: boolean;
}

/**
 * Supabase Authのログインセッションを検証し、対応する SALES_PERSON を解決する。
 * 未ログイン、またはログイン中のSupabase Authユーザーに対応する営業担当者が存在しない場合は
 * 401 UNAUTHENTICATED。
 */
export async function getCurrentSalesPersonFromSession(): Promise<CurrentSalesPerson> {
  const salesPerson = await getSalesPersonFromSession();

  if (!salesPerson) {
    throw new ApiError("UNAUTHENTICATED", "ログインしていません");
  }

  return { salesPersonId: salesPerson.sales_person_id, isManager: salesPerson.is_manager };
}

/**
 * X-Sales-Person-Id ヘッダーを読み取り、SALES_PERSON の存在確認を行う。
 * ヘッダー未指定・数値でない・該当レコードが存在しない場合はいずれも 401 UNAUTHENTICATED。
 * `GET /api/sales-persons` はこの関数を呼ばずに実装する（ヘッダー無しで呼び出し可能な例外のため）。
 *
 * @deprecated クライアントが任意の sales_person_id を指定できてしまう（Issue #78）。
 * 新規・移行済みのルートは getCurrentSalesPersonFromSession を使うこと。
 */
export async function getCurrentSalesPerson(request: NextRequest): Promise<CurrentSalesPerson> {
  const headerValue = request.headers.get(SALES_PERSON_ID_HEADER);

  if (headerValue === null || headerValue.trim() === "") {
    throw new ApiError("UNAUTHENTICATED", "X-Sales-Person-Id ヘッダーが必要です");
  }

  const salesPersonId = Number(headerValue);
  if (!Number.isInteger(salesPersonId)) {
    throw new ApiError("UNAUTHENTICATED", "X-Sales-Person-Id ヘッダーの値が不正です");
  }

  const salesPerson = await prisma.salesPerson.findUnique({
    where: { sales_person_id: salesPersonId },
    select: { sales_person_id: true, is_manager: true },
  });

  if (!salesPerson) {
    throw new ApiError("UNAUTHENTICATED", "指定された営業担当者が存在しません");
  }

  return { salesPersonId: salesPerson.sales_person_id, isManager: salesPerson.is_manager };
}

/** 上長でなければ 403 FORBIDDEN。コメント投稿などマネージャー限定操作の入口で使う。 */
export function requireManager(current: CurrentSalesPerson): void {
  if (!current.isManager) {
    throw new ApiError("FORBIDDEN", "この操作には上長権限が必要です");
  }
}
