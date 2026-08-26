// 顧客マスタ API: 一覧取得（会社名部分一致検索）・登録
// 参照: docs/api-specification.md 4.1 GET /api/customers / 4.3 POST /api/customers
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentSalesPerson } from "@/lib/api/auth";
import { withApiHandler } from "@/lib/api/handler";
import { errorResponseSchema, registry, salesPersonIdHeaderParam } from "@/lib/api/openapi";
import {
  customerBodySchema,
  customerListQuerySchema,
  customerResponseSchema,
  toCustomerResponse,
} from "@/lib/api/schemas/customer";
import { parseJsonBody, parseSearchParams } from "@/lib/api/validation";

const headersSchema = z.object({ "X-Sales-Person-Id": salesPersonIdHeaderParam });

registry.registerPath({
  method: "get",
  path: "/customers",
  summary: "顧客一覧取得（会社名検索可）",
  request: { headers: headersSchema, query: customerListQuerySchema },
  responses: {
    200: {
      description: "顧客一覧",
      content: { "application/json": { schema: z.array(customerResponseSchema) } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

registry.registerPath({
  method: "post",
  path: "/customers",
  summary: "顧客登録",
  request: {
    headers: headersSchema,
    body: { content: { "application/json": { schema: customerBodySchema } } },
  },
  responses: {
    201: {
      description: "登録した顧客",
      content: { "application/json": { schema: customerResponseSchema } },
    },
    401: {
      description: "未認証",
      content: { "application/json": { schema: errorResponseSchema } },
    },
    422: {
      description: "入力エラー",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const GET = withApiHandler(async (request: NextRequest) => {
  await getCurrentSalesPerson(request);

  const { company_name } = parseSearchParams(request.nextUrl.searchParams, customerListQuerySchema);

  const customers = await prisma.customer.findMany({
    where: company_name ? { company_name: { contains: company_name } } : undefined,
    orderBy: { customer_id: "asc" },
  });

  return NextResponse.json(customers.map(toCustomerResponse));
});

export const POST = withApiHandler(async (request: NextRequest) => {
  await getCurrentSalesPerson(request);

  const body = await parseJsonBody(request, customerBodySchema);

  const created = await prisma.customer.create({
    data: {
      company_name: body.company_name,
      contact_person: body.contact_person ?? null,
      phone: body.phone ?? null,
      email: body.email ?? null,
      address: body.address ?? null,
    },
  });

  return NextResponse.json(toCustomerResponse(created), { status: 201 });
});
