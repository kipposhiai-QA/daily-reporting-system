// APIルートの現在ユーザー解決。
// 参照: Issue #78（X-Sales-Person-Id ヘッダーをクライアントが自由に偽装できる問題への対応）
//
// 全APIルートがSupabase Authのログインセッション（cookie）を検証する
// getCurrentSalesPersonFromSession に移行済み（Stage 1/3: reports/comments、
// Stage 2/3: sales-persons、Stage 3/3: customers）。旧来の X-Sales-Person-Id ヘッダーを
// 無条件に信頼する方式（docs/api-specification.md 1.2 旧「認証代替」）は廃止した。
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { ApiError } from "./errors";

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

/** 上長でなければ 403 FORBIDDEN。コメント投稿などマネージャー限定操作の入口で使う。 */
export function requireManager(current: CurrentSalesPerson): void {
  if (!current.isManager) {
    throw new ApiError("FORBIDDEN", "この操作には上長権限が必要です");
  }
}
