// 日報 API: 一覧取得（権限によりスコープが変化する）
// 参照: docs/api-specification.md 5.1 GET /api/reports
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPerson } from "@/lib/api/auth";
import { parseDateOnly } from "@/lib/api/datetime";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry, salesPersonIdHeaderParam } from "@/lib/api/openapi";
import {
  reportListItemResponseSchema,
  reportListQuerySchema,
  toReportListItemResponse,
} from "@/lib/api/schemas/report";
import { parseSearchParams } from "@/lib/api/validation";

const headersSchema = z.object({ "X-Sales-Person-Id": salesPersonIdHeaderParam });

registry.registerPath({
  method: "get",
  path: "/reports",
  summary: "日報一覧取得（権限によりスコープ変化）",
  description:
    "営業は自分が作成した日報のみ（DRAFT/SUBMITTED両方）。上長はSUBMITTEDのみ全営業分（sales_person_idで絞り込み可）。",
  request: { headers: headersSchema, query: reportListQuerySchema },
  responses: {
    200: {
      description: "日報一覧",
      content: { "application/json": { schema: z.array(reportListItemResponseSchema) } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const GET = withApiHandler(async (request: NextRequest) => {
  const current = await getCurrentSalesPerson(request);
  const query = parseSearchParams(request.nextUrl.searchParams, reportListQuerySchema);

  const dateFilter =
    query.date_from || query.date_to
      ? {
          ...(query.date_from ? { gte: parseDateOnly(query.date_from) } : {}),
          ...(query.date_to ? { lte: parseDateOnly(query.date_to) } : {}),
        }
      : undefined;

  const where = current.isManager
    ? {
        status: "SUBMITTED" as const,
        ...(query.sales_person_id !== undefined ? { sales_person_id: query.sales_person_id } : {}),
        ...(dateFilter ? { report_date: dateFilter } : {}),
      }
    : {
        sales_person_id: current.salesPersonId,
        ...(dateFilter ? { report_date: dateFilter } : {}),
      };

  const reports = await prisma.dailyReport.findMany({
    where,
    include: {
      sales_person: { select: { name: true } },
      _count: { select: { visit_records: true } },
    },
    orderBy: [{ report_date: "desc" }, { report_id: "desc" }],
  });

  return NextResponse.json(reports.map(toReportListItemResponse));
});
