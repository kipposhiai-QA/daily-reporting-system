import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyReport: {
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
const findManyMock = vi.mocked(prisma.dailyReport.findMany);
const createMock = vi.mocked(prisma.dailyReport.create);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  auth_user_id: "11111111-1111-1111-1111-111111111111",
  created_at: new Date("2026-08-01T09:00:00.000Z"),
  updated_at: new Date("2026-08-01T09:00:00.000Z"),
};

const SUZUKI_MANAGER = { ...YAMADA, sales_person_id: 5, name: "鈴木一郎", is_manager: true };

const REPORT_10 = {
  report_id: 10,
  sales_person_id: 1,
  sales_person: { name: "山田太郎" },
  report_date: new Date("2026-08-25T00:00:00.000Z"),
  status: "SUBMITTED",
  _count: { visit_records: 2 },
};

const REPORT_11 = {
  report_id: 11,
  sales_person_id: 1,
  sales_person: { name: "山田太郎" },
  report_date: new Date("2026-08-24T00:00:00.000Z"),
  status: "DRAFT",
  _count: { visit_records: 0 },
};

const CREATED_REPORT = {
  report_id: 20,
  sales_person_id: 1,
  sales_person: { name: "山田太郎" },
  report_date: new Date("2026-08-26T00:00:00.000Z"),
  status: "SUBMITTED",
  problem: null,
  plan: null,
  created_at: new Date("2026-08-26T09:00:00.000Z"),
  updated_at: new Date("2026-08-26T09:00:00.000Z"),
  visit_records: [
    {
      visit_id: 301,
      customer_id: 1,
      customer: { company_name: "株式会社A社" },
      visit_content: "新商品の提案を実施",
      visit_time: new Date("1970-01-01T10:00:00.000Z"),
      created_at: new Date("2026-08-26T09:00:00.000Z"),
    },
  ],
  comments: [],
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
  return new NextRequest("http://localhost/api/reports", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/reports", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await GET(getRequest("http://localhost/api/reports"));
    expect(response.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("scopes to the caller's own reports (both statuses) for a non-manager", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findManyMock.mockResolvedValue([REPORT_10, REPORT_11] as never);

    const response = await GET(getRequest("http://localhost/api/reports"));

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sales_person_id: 1 } }),
    );
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ report_id: 10, sales_person_name: "山田太郎", visit_count: 2 });
  });

  it("ignores the sales_person_id query for a non-manager", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findManyMock.mockResolvedValue([REPORT_10] as never);

    await GET(getRequest("http://localhost/api/reports?sales_person_id=2"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sales_person_id: 1 } }),
    );
  });

  it("scopes to SUBMITTED across all sales persons for a manager", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findManyMock.mockResolvedValue([REPORT_10] as never);

    const response = await GET(getRequest("http://localhost/api/reports"));

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "SUBMITTED" } }),
    );
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].report_id).toBe(10);
  });

  it("lets a manager filter by sales_person_id", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findManyMock.mockResolvedValue([REPORT_10] as never);

    await GET(getRequest("http://localhost/api/reports?sales_person_id=1"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "SUBMITTED", sales_person_id: 1 } }),
    );
  });

  it("applies date_from/date_to filters", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findManyMock.mockResolvedValue([] as never);

    await GET(getRequest("http://localhost/api/reports?date_from=2026-08-25&date_to=2026-08-31"));

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          sales_person_id: 1,
          report_date: {
            gte: new Date("2026-08-25T00:00:00.000Z"),
            lte: new Date("2026-08-31T00:00:00.000Z"),
          },
        },
      }),
    );
  });
});

describe("POST /api/reports", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await POST(
      postRequest({ report_date: "2026-08-26", status: "DRAFT", visit_records: [] }),
    );
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("returns 422 when SUBMITTED has no visit_records", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await POST(
      postRequest({ report_date: "2026-08-26", status: "SUBMITTED", visit_records: [] }),
    );

    expect(response.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when visit_content exceeds 500 characters", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await POST(
      postRequest({
        report_date: "2026-08-26",
        status: "SUBMITTED",
        visit_records: [{ customer_id: 1, visit_content: "訪".repeat(501) }],
      }),
    );

    expect(response.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when problem exceeds 1000 characters", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await POST(
      postRequest({
        report_date: "2026-08-26",
        status: "DRAFT",
        problem: "問".repeat(1001),
        visit_records: [],
      }),
    );

    expect(response.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when plan exceeds 1000 characters", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await POST(
      postRequest({
        report_date: "2026-08-26",
        status: "DRAFT",
        plan: "計".repeat(1001),
        visit_records: [],
      }),
    );

    expect(response.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("accepts visit_content/problem/plan at their max length boundary (500/1000/1000) and returns 201", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    const visitContent = "訪".repeat(500);
    const problem = "問".repeat(1000);
    const plan = "計".repeat(1000);
    createMock.mockResolvedValue({
      ...CREATED_REPORT,
      problem,
      plan,
      visit_records: [
        {
          visit_id: 201,
          customer_id: 1,
          customer: { company_name: "株式会社A社" },
          visit_content: visitContent,
          visit_time: null,
          created_at: new Date("2026-08-26T09:00:00.000Z"),
        },
      ],
    } as never);

    const response = await POST(
      postRequest({
        report_date: "2026-08-26",
        status: "SUBMITTED",
        problem,
        plan,
        visit_records: [{ customer_id: 1, visit_content: visitContent }],
      }),
    );

    expect(response.status).toBe(201);
  });

  it("allows DRAFT with zero visit_records and returns 201", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockResolvedValue({
      ...CREATED_REPORT,
      status: "DRAFT",
      visit_records: [],
    } as never);

    const response = await POST(
      postRequest({ report_date: "2026-08-26", status: "DRAFT", visit_records: [] }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sales_person_id: 1,
          report_date: new Date("2026-08-26T00:00:00.000Z"),
          status: "DRAFT",
          visit_records: { create: [] },
        }),
      }),
    );
  });

  it("returns 409 when the (sales_person_id, report_date) pair already exists", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const response = await POST(
      postRequest({
        report_date: "2026-08-25",
        status: "SUBMITTED",
        visit_records: [{ customer_id: 1, visit_content: "訪問" }],
      }),
    );

    expect(response.status).toBe(409);
  });

  it("returns 422 when a visit_record references a non-existent customer_id", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "7.9.1",
      }),
    );

    const response = await POST(
      postRequest({
        report_date: "2026-08-26",
        status: "SUBMITTED",
        visit_records: [{ customer_id: 9999, visit_content: "訪問" }],
      }),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("指定された顧客が見つかりません");
  });

  it("creates a SUBMITTED report using the session identity, ignoring a body sales_person_id", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockResolvedValue(CREATED_REPORT as never);

    const response = await POST(
      postRequest({
        sales_person_id: 999,
        report_date: "2026-08-26",
        status: "SUBMITTED",
        visit_records: [
          { customer_id: 1, visit_content: "新商品の提案を実施", visit_time: "10:00" },
        ],
      }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sales_person_id: 1,
          visit_records: {
            create: [
              {
                customer_id: 1,
                visit_content: "新商品の提案を実施",
                visit_time: new Date("1970-01-01T10:00:00.000Z"),
              },
            ],
          },
        }),
      }),
    );
    const body = await response.json();
    expect(body.sales_person_id).toBe(1);
  });
});
