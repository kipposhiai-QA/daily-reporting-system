// Supabase Authのセッションから、対応する営業マスタ(SalesPerson)レコードを解決する。
// 参照: Issue #62（ログイン中のユーザー情報を各画面のAPI呼び出しで使う仕組みを追加する）
//
// lib/api/auth.ts の getCurrentSalesPersonFromSession はこの関数をそのまま利用する
// 薄いラッパー（参照: Issue #78）。GET /api/auth/me（フロントエンドの画面表示用）も同様に使う。
import type { SalesPerson } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * ログイン中のSupabase Authユーザーを取得し、`auth_user_id` で対応するSalesPersonを解決する。
 * 未ログイン、またはauth_user_idに対応するSalesPersonが存在しない場合はnullを返す。
 */
export async function getSalesPersonFromSession(): Promise<SalesPerson | null> {
  const supabase = await createClient();
  // getSession()ではなくgetUser()を使う（cookieの内容をそのまま信用せず、Supabase Authサーバーに問い合わせて検証するため）。
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    // cookieの内容が不正・期限切れ等で検証に失敗した場合、原因調査のため詳細をログ出力する。
    console.error("[getSalesPersonFromSession] supabase.auth.getUser() failed:", {
      message: error.message,
      status: error.status,
      name: error.name,
    });
  }

  if (!user) return null;

  const salesPerson = await prisma.salesPerson.findUnique({ where: { auth_user_id: user.id } });

  if (!salesPerson) {
    // Supabase Authのセッションは有効だが、対応する SalesPerson.auth_user_id が存在しないケース。
    // 原因調査のため、どのauth_user_id/emailで紐付け先が見つからなかったかをログ出力する。
    console.error("[getSalesPersonFromSession] no SalesPerson found for authenticated user:", {
      auth_user_id: user.id,
      email: user.email,
    });
  }

  return salesPerson;
}
