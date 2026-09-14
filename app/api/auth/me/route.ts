// ログイン中のユーザー情報取得API（Supabase Authセッションから解決）
// 参照: Issue #62（ログイン中のユーザー情報を各画面のAPI呼び出しで使う仕組みを追加する）
//
// 他のAPI（docs/api-specification.md）と異なり X-Sales-Person-Id ヘッダーは不要・無視する。
// 代わりにSupabase Authのセッション(cookie)から現在のユーザーを解決する。
// フロントエンド（lib/current-user-context.tsx）はこのレスポンスを使って、
// 以降の他API呼び出しに付与する X-Sales-Person-Id を自動的に決定する。
import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry } from "@/lib/api/openapi";
import { salesPersonResponseSchema, toSalesPersonResponse } from "@/lib/api/schemas/sales-person";
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";

registry.registerPath({
  method: "get",
  path: "/auth/me",
  summary: "ログイン中のユーザー情報取得",
  description:
    "X-Sales-Person-Id ヘッダーではなく、Supabase Authのセッション(cookie)から現在のユーザーを解決する。",
  responses: {
    200: {
      description: "ログイン中の営業担当者",
      content: { "application/json": { schema: salesPersonResponseSchema } },
    },
    401: {
      description:
        "未ログイン、またはログイン中のSupabase Authユーザーに対応する営業担当者が存在しない",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const GET = withApiHandler(async () => {
  const salesPerson = await getSalesPersonFromSession();

  if (!salesPerson) {
    throw new ApiError("UNAUTHENTICATED", "ログインしていません");
  }

  return NextResponse.json(toSalesPersonResponse(salesPerson));
});
