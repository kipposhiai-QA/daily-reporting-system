import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    customer: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { GET, POST } from "./route";

const getSalesPersonFromSessionMock = vi.mocked(getSalesPersonFromSession);
const findManyMock = vi.mocked(prisma.customer.findMany);
const createMock = vi.mocked(prisma.customer.create);

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
  findManyMock.mockReset();
  createMock.mockReset();
});

function getRequest(url: string): NextRequest {
  return new NextRequest(url, { headers: { "content-type": "application/json" } });
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/customers", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await GET(getRequest("http://localhost/api/customers"));
    expect(response.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("filters by company_name using a partial match", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    findManyMock.mockResolvedValue([COMPANY_A] as never);

    const response = await GET(getRequest("http://localhost/api/customers?company_name=A社"));

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith({
      where: { company_name: { contains: "A社" } },
      orderBy: { customer_id: "asc" },
    });
    const body = await response.json();
    expect(body).toEqual([
      {
        customer_id: 1,
        company_name: "株式会社A社",
        contact_person: "佐藤様",
        phone: "03-1234-5678",
        email: "sato@a-corp.example.com",
        address: "東京都千代田区...",
        created_at: "2026-08-01T18:00:00+09:00",
        updated_at: "2026-08-01T18:00:00+09:00",
      },
    ]);
  });

  it("returns all customers when company_name is omitted", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    findManyMock.mockResolvedValue([COMPANY_A] as never);

    const response = await GET(getRequest("http://localhost/api/customers"));

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { customer_id: "asc" },
    });
  });
});

describe("POST /api/customers", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await POST(postRequest({ company_name: "株式会社C社" }));
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 422 when company_name is missing", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);

    const response = await POST(postRequest({}));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([{ field: "company_name", message: expect.any(String) }]);
  });

  it.each([
    ["company_name", "会".repeat(201)],
    ["contact_person", "様".repeat(51)],
    ["phone", "0".repeat(21)],
    ["email", `${"a".repeat(243)}@example.com`],
    ["address", "町".repeat(201)],
  ])("returns 422 when %s exceeds its max length", async (field, value) => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);

    const response = await POST(postRequest({ company_name: "株式会社A社", [field]: value }));

    expect(response.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const fields = body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining([field]));
  });

  it("accepts every field at its max length boundary (200/50/20/254/200) and returns 201", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    const companyName = "会".repeat(200);
    const contactPerson = "様".repeat(50);
    const phone = "0".repeat(20);
    const email = `${"a".repeat(242)}@example.com`;
    const address = "町".repeat(200);
    expect(email).toHaveLength(254);
    createMock.mockResolvedValue({
      ...COMPANY_A,
      company_name: companyName,
      contact_person: contactPerson,
      phone,
      email,
      address,
    } as never);

    const response = await POST(
      postRequest({
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        email,
        address,
      }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        company_name: companyName,
        contact_person: contactPerson,
        phone,
        email,
        address,
      },
    });
  });

  it("creates a customer with only company_name and returns 201", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(CURRENT_USER as never);
    createMock.mockResolvedValue({
      ...COMPANY_A,
      contact_person: null,
      phone: null,
      email: null,
      address: null,
    } as never);

    const response = await POST(postRequest({ company_name: "株式会社A社" }));

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: {
        company_name: "株式会社A社",
        contact_person: null,
        phone: null,
        email: null,
        address: null,
      },
    });
  });
});
