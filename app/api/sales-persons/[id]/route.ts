// 営業マスタ API: 詳細取得・更新・削除
// 参照: docs/api-specification.md 3.2 GET /3.4 PUT /3.5 DELETE /api/sales-persons/:id
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPerson } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry, salesPersonIdHeaderParam } from "@/lib/api/openapi";
import {
  mapSalesPersonPrismaError,
  salesPersonBodySchema,
  salesPersonResponseSchema,
  toSalesPersonResponse,
} from "@/lib/api/schemas/sales-person";
import { parseIdParam, parseJsonBody } from "@/lib/api/validation";

type Context = { params: Promise<{ id: string }> };

const pathParamsSchema = z.object({ id: z.string().openapi({ example: "1" }) });
const headersSchema = z.object({ "X-Sales-Person-Id": salesPersonIdHeaderParam });

registry.registerPath({
  method: "get",
  path: "/sales-persons/{id}",
  summary: "営業担当者詳細取得",
  request: { params: pathParamsSchema, headers: headersSchema },
  responses: {
    200: {
      description: "営業担当者詳細",
      content: { "application/json": { schema: salesPersonResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "存在しないID",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "put",
  path: "/sales-persons/{id}",
  summary: "営業担当者更新",
  request: {
    params: pathParamsSchema,
    headers: headersSchema,
    body: { content: { "application/json": { schema: salesPersonBodySchema } } },
  },
  responses: {
    200: {
      description: "更新後の営業担当者",
      content: { "application/json": { schema: salesPersonResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "存在しないID",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "他レコードとのメールアドレス重複",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "入力エラー",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "delete",
  path: "/sales-persons/{id}",
  summary: "営業担当者削除",
  request: { params: pathParamsSchema, headers: headersSchema },
  responses: {
    204: { description: "削除成功" },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "存在しないID",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    409: {
      description: "日報またはコメントから参照されているため削除不可",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const GET = withApiHandler(async (request: NextRequest, { params }: Context) => {
  await getCurrentSalesPerson(request);
  const { id } = await params;
  const salesPersonId = parseIdParam(id);

  const salesPerson = await prisma.salesPerson.findUnique({
    where: { sales_person_id: salesPersonId },
  });
  if (!salesPerson) {
    throw new ApiError("NOT_FOUND", "指定された営業担当者が見つかりません");
  }

  return NextResponse.json(toSalesPersonResponse(salesPerson));
});

export const PUT = withApiHandler(async (request: NextRequest, { params }: Context) => {
  await getCurrentSalesPerson(request);
  const { id } = await params;
  const salesPersonId = parseIdParam(id);

  const body = await parseJsonBody(request, salesPersonBodySchema);

  try {
    const updated = await prisma.salesPerson.update({
      where: { sales_person_id: salesPersonId },
      data: {
        name: body.name,
        email: body.email,
        department: body.department ?? null,
        is_manager: body.is_manager ?? false,
      },
    });
    return NextResponse.json(toSalesPersonResponse(updated));
  } catch (error) {
    mapSalesPersonPrismaError(error);
  }
});

export const DELETE = withApiHandler(async (request: NextRequest, { params }: Context) => {
  await getCurrentSalesPerson(request);
  const { id } = await params;
  const salesPersonId = parseIdParam(id);

  try {
    await prisma.salesPerson.delete({ where: { sales_person_id: salesPersonId } });
  } catch (error) {
    mapSalesPersonPrismaError(error);
  }

  return new NextResponse(null, { status: 204 });
});
