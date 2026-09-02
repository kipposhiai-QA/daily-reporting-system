// Supabase Authのセッションから、対応する営業マスタ(SalesPerson)レコードを解決する。
// 参照: Issue #62（ログイン中のユーザー情報を各画面のAPI呼び出しで使う仕組みを追加する）
//
// docs/api-specification.md の X-Sales-Person-Id ヘッダー（疑似認証）とは別軸の仕組み。
// lib/api/auth.ts の getCurrentSalesPerson はそのヘッダーを読むためのもので、こちらは
// フロントエンドがヘッダーに設定すべき sales_person_id を決めるための、ログインセッション側の解決に使う。
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
  } = await supabase.auth.getUser();

  if (!user) return null;

  return prisma.salesPerson.findUnique({ where: { auth_user_id: user.id } });
}
