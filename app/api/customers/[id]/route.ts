// 顧客マスタ API: 詳細取得・更新・削除
// 参照: docs/api-specification.md 4.2 GET /4.4 PUT /4.5 DELETE /api/customers/:id
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPerson } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry, salesPersonIdHeaderParam } from "@/lib/api/openapi";
import {
  customerBodySchema,
  customerResponseSchema,
  mapCustomerPrismaError,
  toCustomerResponse,
} from "@/lib/api/schemas/customer";
import { parseIdParam, parseJsonBody } from "@/lib/api/validation";

type Context = { params: Promise<{ id: string }> };

const pathParamsSchema = z.object({ id: z.string().openapi({ example: "1" }) });
const headersSchema = z.object({ "X-Sales-Person-Id": salesPersonIdHeaderParam });

registry.registerPath({
  method: "get",
  path: "/customers/{id}",
  summary: "顧客詳細取得",
  request: { params: pathParamsSchema, headers: headersSchema },
  responses: {
    200: {
      description: "顧客詳細",
      content: { "application/json": { schema: customerResponseSchema } },
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
  path: "/customers/{id}",
  summary: "顧客更新",
  request: {
    params: pathParamsSchema,
    headers: headersSchema,
    body: { content: { "application/json": { schema: customerBodySchema } } },
  },
  responses: {
    200: {
      description: "更新後の顧客",
      content: { "application/json": { schema: customerResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    404: {
      description: "存在しないID",
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
  path: "/customers/{id}",
  summary: "顧客削除",
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
      description: "訪問記録から参照されているため削除不可",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const GET = withApiHandler(async (request: NextRequest, { params }: Context) => {
  await getCurrentSalesPerson(request);
  const { id } = await params;
  const customerId = parseIdParam(id);

  const customer = await prisma.customer.findUnique({ where: { customer_id: customerId } });
  if (!customer) {
    throw new ApiError("NOT_FOUND", "指定された顧客が見つかりません");
  }

  return NextResponse.json(toCustomerResponse(customer));
});

export const PUT = withApiHandler(async (request: NextRequest, { params }: Context) => {
  await getCurrentSalesPerson(request);
  const { id } = await params;
  const customerId = parseIdParam(id);

  const body = await parseJsonBody(request, customerBodySchema);

  try {
    const updated = await prisma.customer.update({
      where: { customer_id: customerId },
      data: {
        company_name: body.company_name,
        contact_person: body.contact_person ?? null,
        phone: body.phone ?? null,
        email: body.email ?? null,
        address: body.address ?? null,
      },
    });
    return NextResponse.json(toCustomerResponse(updated));
  } catch (error) {
    mapCustomerPrismaError(error);
  }
});

export const DELETE = withApiHandler(async (request: NextRequest, { params }: Context) => {
  await getCurrentSalesPerson(request);
  const { id } = await params;
  const customerId = parseIdParam(id);

  try {
    await prisma.customer.delete({ where: { customer_id: customerId } });
  } catch (error) {
    mapCustomerPrismaError(error);
  }

  return new NextResponse(null, { status: 204 });
});
