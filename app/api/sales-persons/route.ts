// 営業マスタ API: 一覧取得・登録
// 参照: docs/api-specification.md 3.1 GET /api/sales-persons / 3.3 POST /api/sales-persons
// 認証(POST): Supabase Authのログインセッション（cookie）で本人を識別する（Issue #78 Stage 2/3）。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPersonFromSession } from "@/lib/api/auth";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry } from "@/lib/api/openapi";
import {
  mapSalesPersonPrismaError,
  salesPersonBodySchema,
  salesPersonResponseSchema,
  toSalesPersonResponse,
} from "@/lib/api/schemas/sales-person";
import { parseJsonBody } from "@/lib/api/validation";

registry.registerPath({
  method: "get",
  path: "/sales-persons",
  summary: "営業担当者一覧取得",
  description: "未ログインでも呼び出し可能な唯一の例外。",
  responses: {
    200: {
      description: "営業担当者一覧",
      content: { "application/json": { schema: z.array(salesPersonResponseSchema) } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/sales-persons",
  summary: "営業担当者登録",
  description: "認証はSupabase Authのログインセッション（cookie）で行う。",
  request: {
    body: { content: { "application/json": { schema: salesPersonBodySchema } } },
  },
  responses: {
    201: {
      description: "登録した営業担当者",
      content: { "application/json": { schema: salesPersonResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "メールアドレス重複",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "入力エラー",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const GET = withApiHandler(async () => {
  const salesPersons = await prisma.salesPerson.findMany({
    orderBy: { sales_person_id: "asc" },
  });
  return NextResponse.json(salesPersons.map(toSalesPersonResponse));
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await getCurrentSalesPersonFromSession();

  const body = await parseJsonBody(request, salesPersonBodySchema);

  try {
    const created = await prisma.salesPerson.create({
      data: {
        name: body.name,
        email: body.email,
        department: body.department ?? null,
        is_manager: body.is_manager ?? false,
      },
    });
    return NextResponse.json(toSalesPersonResponse(created), { status: 201 });
  } catch (error) {
    mapSalesPersonPrismaError(error);
  }
});
