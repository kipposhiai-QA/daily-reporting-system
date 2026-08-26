// コメント API: 投稿
// 参照: docs/api-specification.md 6.1 POST /api/reports/:id/comments
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPerson, requireManager } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry, salesPersonIdHeaderParam } from "@/lib/api/openapi";
import {
  commentBodySchema,
  commentResponseSchema,
  toCommentResponse,
} from "@/lib/api/schemas/comment";
import { parseIdParam, parseJsonBody } from "@/lib/api/validation";

type Context = { params: Promise<{ id: string }> };

const pathParamsSchema = z.object({ id: z.string().openapi({ example: "10" }) });
const headersSchema = z.object({ "X-Sales-Person-Id": salesPersonIdHeaderParam });

registry.registerPath({
  method: "post",
  path: "/reports/{id}/comments",
  summary: "コメント投稿",
  description:
    "投稿者はis_manager=trueである必要がある（営業は403）。対象日報はSUBMITTEDのみコメント可能（DRAFTは403）。",
  request: {
    params: pathParamsSchema,
    headers: headersSchema,
    body: { content: { "application/json": { schema: commentBodySchema } } },
  },
  responses: {
    201: {
      description: "投稿したコメント",
      content: { "application/json": { schema: commentResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    403: {
      description: "権限なし（営業によるコメント、またはDRAFTへのコメント）",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "日報が存在しない",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "入力エラー",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const POST = withApiHandler(async (request: NextRequest, { params }: Context) => {
  const current = await getCurrentSalesPerson(request);
  requireManager(current);

  const { id } = await params;
  const reportId = parseIdParam(id);

  const report = await prisma.dailyReport.findUnique({
    where: { report_id: reportId },
    select: { status: true },
  });
  if (!report) {
    throw new ApiError("NOT_FOUND", "指定された日報が見つかりません");
  }
  if (report.status === "DRAFT") {
    throw new ApiError("FORBIDDEN", "提出済みの日報にのみコメントできます");
  }

  const body = await parseJsonBody(request, commentBodySchema);

  const created = await prisma.managerComment.create({
    data: {
      report_id: reportId,
      manager_id: current.salesPersonId,
      comment: body.comment,
    },
    include: { manager: { select: { name: true } } },
  });

  return NextResponse.json(toCommentResponse(created), { status: 201 });
});
