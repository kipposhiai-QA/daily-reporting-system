import { createClient } from "@supabase/supabase-js";

/**
 * Supabase Admin API（Service Roleキー使用）用のクライアント。
 * サーバー側専用（Route Handlerからのみ呼び出す想定）。SUPABASE_SERVICE_ROLE_KEY は
 * NEXT_PUBLIC_ プレフィックスを付けず、ブラウザバンドルに含まれない環境変数として管理する
 * （参照: docs/deployment.md「Supabase Service Roleキーの管理方式」、Issue #74）。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が設定されていません");
  }

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
