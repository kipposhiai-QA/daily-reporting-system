// 日報 API: 詳細取得（訪問記録・コメントを含む）
// 参照: docs/api-specification.md 5.2 GET /api/reports/:id
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPerson } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry, salesPersonIdHeaderParam } from "@/lib/api/openapi";
import { reportDetailResponseSchema, toReportDetailResponse } from "@/lib/api/schemas/report";
import { parseIdParam } from "@/lib/api/validation";

type Context = { params: Promise<{ id: string }> };

const pathParamsSchema = z.object({ id: z.string().openapi({ example: "10" }) });
const headersSchema = z.object({ "X-Sales-Person-Id": salesPersonIdHeaderParam });

registry.registerPath({
  method: "get",
  path: "/reports/{id}",
  summary: "日報詳細取得（訪問記録・コメント含む）",
  description:
    "DRAFTは作成者本人のみアクセス可。SUBMITTEDは作成者本人または上長がアクセス可。それ以外は403。",
  request: { params: pathParamsSchema, headers: headersSchema },
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

export const GET = withApiHandler(async (request: NextRequest, { params }: Context) => {
  const current = await getCurrentSalesPerson(request);
  const { id } = await params;
  const reportId = parseIdParam(id);

  const report = await prisma.dailyReport.findUnique({
    where: { report_id: reportId },
    include: {
      sales_person: { select: { name: true } },
      visit_records: {
        include: { customer: { select: { company_name: true } } },
        orderBy: { visit_time: "asc" },
      },
      comments: {
        include: { manager: { select: { name: true } } },
        orderBy: { created_at: "asc" },
      },
    },
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
