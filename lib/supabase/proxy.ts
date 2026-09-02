// proxy.ts（Next.js 16のProxy、旧middleware）用のSupabaseクライアント生成・セッション検証。
// 参照: Issue #64（未ログイン時のルート保護）
//
// lib/supabase/server.tsとは異なり、next/headersのcookies()が使えないため、
// NextRequest/NextResponseのcookie APIでセッションのcookieを読み書きする。
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * リクエストのcookieからSupabase Authセッションを検証し、
 * リフレッシュ後のcookieを反映したNextResponseとログイン中のユーザーを返す。
 * getSession()ではなくgetUser()を使う（cookieの内容をそのまま信用せず、Supabase Authサーバーに問い合わせて検証するため。
 * 参照: lib/supabase/current-sales-person.ts）。
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません",
    );
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
