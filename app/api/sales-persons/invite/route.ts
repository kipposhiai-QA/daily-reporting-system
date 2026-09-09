// 営業担当者招待 API: SalesPersonレコードの作成とSupabase Auth招待メール送信を一体で行う
// 参照: Issue #74（新規担当者の招待フローを追加する）
// 認証: Supabase Authのログインセッション（cookie）で本人を識別する（Issue #78 Stage 2/3）。
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPersonFromSession, requireManager } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry } from "@/lib/api/openapi";
import {
  mapSalesPersonPrismaError,
  salesPersonBodySchema,
  salesPersonResponseSchema,
  toSalesPersonResponse,
} from "@/lib/api/schemas/sales-person";
import { parseJsonBody } from "@/lib/api/validation";
import { createAdminClient } from "@/lib/supabase/admin";

registry.registerPath({
  method: "post",
  path: "/sales-persons/invite",
  summary: "営業担当者の招待（SalesPerson作成 + Supabase Auth招待メール送信）",
  description:
    "SalesPersonレコードを作成した上で、Supabase Admin API (inviteUserByEmail) により" +
    "認証ユーザーを招待し、SalesPerson.auth_user_id に紐付ける。招待メール送信に失敗した場合は" +
    "作成したSalesPersonレコードを削除しロールバックする。認証はSupabase Authのログインセッション" +
    "（cookie）で行う。招待は上長（is_manager=true）のみ実行可能（営業は403。参照: Issue #102）。",
  request: {
    body: { content: { "application/json": { schema: salesPersonBodySchema } } },
  },
  responses: {
    201: {
      description: "招待した営業担当者（auth_user_id付き）",
      content: { "application/json": { schema: salesPersonResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    403: {
      description: "権限なし（上長以外による招待）",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "メールアドレス重複、または招待メール送信失敗",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "入力エラー",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const POST = withApiHandler(async (request: NextRequest) => {
  const current = await getCurrentSalesPersonFromSession();
  requireManager(current);

  const body = await parseJsonBody(request, salesPersonBodySchema);

  const created = await (async () => {
    try {
      return await prisma.salesPerson.create({
        data: {
          name: body.name,
          email: body.email,
          department: body.department ?? null,
          is_manager: body.is_manager ?? false,
        },
      });
    } catch (error) {
      mapSalesPersonPrismaError(error);
    }
  })();

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(body.email, {
    redirectTo: `${request.nextUrl.origin}/reset-password/confirm`,
  });

  if (error || !data.user) {
    // Supabase Auth側の招待に失敗した場合（既にAuthユーザーが存在する等）は、
    // 直前に作成したSalesPersonレコードを削除してロールバックする。
    await prisma.salesPerson.delete({ where: { sales_person_id: created.sales_person_id } });
    throw new ApiError(
      "CONFLICT",
      `招待メールの送信に失敗しました${error?.message ? `: ${error.message}` : ""}`,
    );
  }

  const updated = await prisma.salesPerson.update({
    where: { sales_person_id: created.sales_person_id },
    data: { auth_user_id: data.user.id },
  });

  return NextResponse.json(toSalesPersonResponse(updated), { status: 201 });
});
