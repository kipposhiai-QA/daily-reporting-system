import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
      findUnique: vi.fn(),
    },
    customer: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const findUniqueSalesPersonMock = vi.mocked(prisma.salesPerson.findUnique);
const findManyMock = vi.mocked(prisma.customer.findMany);
const createMock = vi.mocked(prisma.customer.create);

const CURRENT_USER = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
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
  findUniqueSalesPersonMock.mockReset();
  findManyMock.mockReset();
  createMock.mockReset();
});

function withAuthHeader(headers: Record<string, string> = {}): Record<string, string> {
  return { "X-Sales-Person-Id": "1", ...headers };
}

function getRequest(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(url, { headers: { "content-type": "application/json", ...headers } });
}

function postRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/customers", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("GET /api/customers", () => {
  it("returns 401 when the auth header is missing", async () => {
    const response = await GET(getRequest("http://localhost/api/customers"));
    expect(response.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("filters by company_name using a partial match", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(CURRENT_USER as never);
    findManyMock.mockResolvedValue([COMPANY_A] as never);

    const response = await GET(
      getRequest("http://localhost/api/customers?company_name=A社", withAuthHeader()),
    );

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
    findUniqueSalesPersonMock.mockResolvedValue(CURRENT_USER as never);
    findManyMock.mockResolvedValue([COMPANY_A] as never);

    const response = await GET(getRequest("http://localhost/api/customers", withAuthHeader()));

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith({
      where: undefined,
      orderBy: { customer_id: "asc" },
    });
  });
});

describe("POST /api/customers", () => {
  it("returns 401 when the auth header is missing", async () => {
    const response = await POST(postRequest({ company_name: "株式会社C社" }));
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 422 when company_name is missing", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(CURRENT_USER as never);

    const response = await POST(postRequest({}, withAuthHeader()));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([{ field: "company_name", message: expect.any(String) }]);
  });

  it("creates a customer with only company_name and returns 201", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(CURRENT_USER as never);
    createMock.mockResolvedValue({
      ...COMPANY_A,
      contact_person: null,
      phone: null,
      email: null,
      address: null,
    } as never);

    const response = await POST(postRequest({ company_name: "株式会社A社" }, withAuthHeader()));

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
