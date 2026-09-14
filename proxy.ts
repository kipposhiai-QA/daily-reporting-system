// 未ログイン状態でのアクセスを制御するProxy（Next.js 16でmiddleware.tsから改称）。
// 参照: Issue #64
//
// - 未ログイン状態でPUBLIC_PATHS以外にアクセスした場合、/loginへリダイレクトする
// - ログイン済み状態で/loginにアクセスした場合、/へリダイレクトする
// - 静的アセット・APIルートはmatcherで対象外にする
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

const LOGIN_PATH = "/login";
const TOP_PATH = "/";
// 未ログインでもアクセスできるページ。/reset-password・/reset-password/confirmは
// パスワードリセットメール経由でのアクセスを想定しており、/reset-password/confirmは
// Supabase Authの回復セッションがクライアント側で確立される前（初回リクエスト時点）は
// userがnullのため、/loginと同様に許可する必要がある（参照: Issue #72）。
const PUBLIC_PATHS = [LOGIN_PATH, "/reset-password", "/reset-password/confirm"];

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const isLoginPath = pathname === LOGIN_PATH;
  const isPublicPath = PUBLIC_PATHS.includes(pathname);

  if (!user && !isPublicPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = LOGIN_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isLoginPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = TOP_PATH;
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    // _next/static, _next/image, favicon.ico, APIルート(/api/**)、
    // および代表的な静的アセットの拡張子を除外する。
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
