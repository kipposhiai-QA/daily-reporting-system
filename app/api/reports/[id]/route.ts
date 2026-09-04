// 日報 API: 詳細取得（訪問記録・コメントを含む）・更新
// 参照: docs/api-specification.md 5.2 GET /api/reports/:id / 5.4 PUT /api/reports/:id
// 認証: Supabase Authのログインセッション（cookie）で本人を識別する（Issue #78 Stage 1/3）。
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPersonFromSession } from "@/lib/api/auth";
import { parseDateOnly, parseTimeOnly } from "@/lib/api/datetime";
import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry } from "@/lib/api/openapi";
import {
  mapReportPrismaError,
  reportBodySchema,
  reportDetailInclude,
  reportDetailResponseSchema,
  toReportDetailResponse,
} from "@/lib/api/schemas/report";
import { parseIdParam, parseJsonBody } from "@/lib/api/validation";

type Context = { params: Promise<{ id: string }> };

const pathParamsSchema = z.object({ id: z.string().openapi({ example: "10" }) });

registry.registerPath({
  method: "get",
  path: "/reports/{id}",
  summary: "日報詳細取得（訪問記録・コメント含む）",
  description:
    "DRAFTは作成者本人のみアクセス可。SUBMITTEDは作成者本人または上長がアクセス可。それ以外は403。認証はSupabase Authのログインセッション（cookie）で行う。",
  request: { params: pathParamsSchema },
  responses: {
    200: {
      description: "日報詳細",
      content: { "application/json": { schema: reportDetailResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    403: {
      description: "アクセス権限なし",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "存在しないID",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const GET = withApiHandler(async (_request: NextRequest, { params }: Context) => {
  const current = await getCurrentSalesPersonFromSession();
  const { id } = await params;
  const reportId = parseIdParam(id);

  const report = await prisma.dailyReport.findUnique({
    where: { report_id: reportId },
    include: reportDetailInclude,
  });

  if (!report) {
    throw new ApiError("NOT_FOUND", "指定された日報が見つかりません");
  }

  const isOwner = report.sales_person_id === current.salesPersonId;
  const isAccessible = report.status === "DRAFT" ? isOwner : isOwner || current.isManager;
  if (!isAccessible) {
    throw new ApiError("FORBIDDEN", "この日報にアクセスする権限がありません");
  }

  return NextResponse.json(toReportDetailResponse(report));
});

registry.registerPath({
  method: "put",
  path: "/reports/{id}",
  summary: "日報更新（下書き/提出）",
  description:
    "作成者本人のみ許可。visit_recordsは送信内容で全置換する（既存の訪問記録は一旦削除し、送信された配列で作り直す）。",
  request: {
    params: pathParamsSchema,
    body: { content: { "application/json": { schema: reportBodySchema } } },
  },
  responses: {
    200: {
      description: "更新後の日報の詳細",
      content: { "application/json": { schema: reportDetailResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    403: {
      description: "作成者本人でない",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "存在しないID",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "対象日を変更した結果、他の自分の日報と重複",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "入力エラー",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const PUT = withApiHandler(async (request: NextRequest, { params }: Context) => {
  const current = await getCurrentSalesPersonFromSession();
  const { id } = await params;
  const reportId = parseIdParam(id);

  const existing = await prisma.dailyReport.findUnique({
    where: { report_id: reportId },
    select: { sales_person_id: true },
  });
  if (!existing) {
    throw new ApiError("NOT_FOUND", "指定された日報が見つかりません");
  }
  if (existing.sales_person_id !== current.salesPersonId) {
    throw new ApiError("FORBIDDEN", "この日報を更新する権限がありません");
  }

  const body = await parseJsonBody(request, reportBodySchema);

  try {
    const updated = await prisma.dailyReport.update({
      where: { report_id: reportId },
      data: {
        report_date: parseDateOnly(body.report_date),
        status: body.status,
        problem: body.problem ?? null,
        plan: body.plan ?? null,
        visit_records: {
          deleteMany: {},
          create: body.visit_records.map((visit) => ({
            customer_id: visit.customer_id,
            visit_content: visit.visit_content,
            visit_time: visit.visit_time ? parseTimeOnly(visit.visit_time) : null,
          })),
        },
      },
      include: reportDetailInclude,
    });
    return NextResponse.json(toReportDetailResponse(updated));
  } catch (error) {
    mapReportPrismaError(error);
  }
});
