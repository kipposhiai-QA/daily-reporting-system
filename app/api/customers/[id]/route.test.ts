import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { DELETE, GET, PUT } from "./route";

const getSalesPersonFromSessionMock = vi.mocked(getSalesPersonFromSession);
const findUniqueMock = vi.mocked(prisma.customer.findUnique);
const updateMock = vi.mocked(prisma.customer.update);
const deleteMock = vi.mocked(prisma.customer.delete);

const CURRENT_USER = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  auth_user_id: "11111111-1111-1111-1111-111111111111",
  created_at: new Date("2026-08-01T09:00:00.000Z"),
  updated_at: new Date("2026-08-01T09:00:00.000Z"),
};

const COMPANY_A = {
  customer_id: 1,
  company_name: "株式会社A社",
  contact_person: "佐藤様",
  phone: "03-1234-5678",
  email: "sato@a-corp.example.com",
  address: "東京都千代田区...",
  created_at: new Date("2026-08-01T09:00:00.000Z"),
  updated_at: new Date("2026-08-01T09:00:00.000Z"),
};

beforeEach(() => {
  getSalesPersonFromSessionMock.mockReset();
  findUniqueMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
});

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers/1", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json" },
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/customers/:id", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await GET(makeRequest("GET"), ctx("1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the customer does not exist", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    findUniqueMock.mockResolvedValue(null as never);

    const response = await GET(makeRequest("GET"), ctx("999"));
    expect(response.status).toBe(404);
  });

  it("returns 200 with the customer detail", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    findUniqueMock.mockResolvedValue(COMPANY_A as never);

    const response = await GET(makeRequest("GET"), ctx("1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.customer_id).toBe(1);
    expect(body.created_at).toBe("2026-08-01T18:00:00+09:00");
  });
});

describe("PUT /api/customers/:id", () => {
  it("returns 404 when updating a non-existent customer", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "7.9.1",
      }),
    );

    const response = await PUT(makeRequest("PUT", { company_name: "株式会社Z社" }), ctx("999"));

    expect(response.status).toBe(404);
  });

  it("returns 422 when company_name is missing", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);

    const response = await PUT(makeRequest("PUT", {}), ctx("1"));

    expect(response.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("updates and returns 200 on success", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    updateMock.mockResolvedValue({ ...COMPANY_A, company_name: "株式会社A社（改称）" } as never);

    const response = await PUT(
      makeRequest("PUT", {
        company_name: "株式会社A社（改称）",
        contact_person: "佐藤様",
        phone: "03-1234-5678",
        email: "sato@a-corp.example.com",
        address: "東京都千代田区...",
      }),
      ctx("1"),
    );

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { customer_id: 1 },
      data: {
        company_name: "株式会社A社（改称）",
        contact_person: "佐藤様",
        phone: "03-1234-5678",
        email: "sato@a-corp.example.com",
        address: "東京都千代田区...",
      },
    });
  });
});

describe("DELETE /api/customers/:id", () => {
  it("returns 409 when the customer is referenced by a visit record", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    deleteMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "7.9.1",
      }),
    );

    const response = await DELETE(makeRequest("DELETE"), ctx("1"));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.message).toBe("この顧客は訪問記録で使用されているため削除できません");
  });

  it("returns 204 on successful deletion", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    deleteMock.mockResolvedValue(COMPANY_A as never);

    const response = await DELETE(makeRequest("DELETE"), ctx("2"));

    expect(response.status).toBe(204);
  });
});
