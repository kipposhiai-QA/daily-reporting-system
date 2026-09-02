import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * サーバー側（Route Handler・Server Component）用のSupabaseクライアントを生成する。
 * cookieからセッションを読み取る。Server Componentから呼ばれた場合はcookieの書き込みができないため、
 * setAllの失敗は無視する（セッションのリフレッシュはmiddleware導入後に整理する想定）。
 */
export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Componentから呼ばれた場合はcookieを書き込めないため無視する。
        }
      },
    },
  });
}
