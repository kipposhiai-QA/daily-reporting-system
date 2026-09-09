import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyReport: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { GET, PUT } from "./route";

const getSalesPersonFromSessionMock = vi.mocked(getSalesPersonFromSession);
const findUniqueReportMock = vi.mocked(prisma.dailyReport.findUnique);
const updateMock = vi.mocked(prisma.dailyReport.update);

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

const TANAKA = { ...YAMADA, sales_person_id: 2, name: "田中花子" };
const SUZUKI_MANAGER = { ...YAMADA, sales_person_id: 5, name: "鈴木一郎", is_manager: true };

function buildReport(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    report_id: 10,
    sales_person_id: 1,
    sales_person: { name: "山田太郎" },
    report_date: new Date("2026-08-25T00:00:00.000Z"),
    status: "SUBMITTED",
    problem: "A社の見積もり承認が遅れている",
    plan: "C社へ初回訪問予定",
    created_at: new Date("2026-08-25T09:00:00.000Z"),
    updated_at: new Date("2026-08-25T09:00:00.000Z"),
    visit_records: [
      {
        visit_id: 101,
        customer_id: 1,
        customer: { company_name: "株式会社A社" },
        visit_content: "新商品の提案を実施",
        visit_time: new Date("1970-01-01T10:00:00.000Z"),
        created_at: new Date("2026-08-25T09:00:00.000Z"),
      },
      {
        visit_id: 102,
        customer_id: 2,
        customer: { company_name: "株式会社B社" },
        visit_content: "定期フォロー訪問",
        visit_time: new Date("1970-01-01T13:30:00.000Z"),
        created_at: new Date("2026-08-25T09:00:00.000Z"),
      },
    ],
    comments: [
      {
        comment_id: 201,
        manager_id: 5,
        manager: { name: "鈴木一郎" },
        comment: "見積もりの件、私からも確認します",
        created_at: new Date("2026-08-25T10:10:00.000Z"),
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  getSalesPersonFromSessionMock.mockReset();
  findUniqueReportMock.mockReset();
  updateMock.mockReset();
});

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost/api/reports/10", {
    headers: { "content-type": "application/json" },
  });
}

function putRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/reports/10", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/reports/:id", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await GET(makeRequest(), ctx("10"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the report does not exist", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue(null as never);

    const response = await GET(makeRequest(), ctx("999"));
    expect(response.status).toBe(404);
  });

  it("allows the owner to access their own DRAFT report", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "DRAFT" }) as never);

    const response = await GET(makeRequest(), ctx("10"));
    expect(response.status).toBe(200);
  });

  it("denies another sales person from accessing a DRAFT report", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(TANAKA as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "DRAFT" }) as never);

    const response = await GET(makeRequest(), ctx("10"));
    expect(response.status).toBe(403);
  });

  it("denies a manager from accessing another sales person's DRAFT report", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "DRAFT" }) as never);

    const response = await GET(makeRequest(), ctx("10"));
    expect(response.status).toBe(403);
  });

  it("allows a manager to access another sales person's SUBMITTED report", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "SUBMITTED" }) as never);

    const response = await GET(makeRequest(), ctx("10"));
    expect(response.status).toBe(200);
  });

  it("denies a non-manager, non-owner from accessing a SUBMITTED report", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(TANAKA as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "SUBMITTED" }) as never);

    const response = await GET(makeRequest(), ctx("10"));
    expect(response.status).toBe(403);
  });

  it("returns visit records and comments in the documented shape and order", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue(buildReport() as never);

    const response = await GET(makeRequest(), ctx("10"));
    const body = await response.json();

    expect(body).toMatchObject({
      report_id: 10,
      sales_person_id: 1,
      sales_person_name: "山田太郎",
      report_date: "2026-08-25",
      status: "SUBMITTED",
      problem: "A社の見積もり承認が遅れている",
      plan: "C社へ初回訪問予定",
    });
    expect(body.visit_records).toEqual([
      expect.objectContaining({ visit_id: 101, customer_name: "株式会社A社", visit_time: "10:00" }),
      expect.objectContaining({ visit_id: 102, customer_name: "株式会社B社", visit_time: "13:30" }),
    ]);
    expect(body.comments).toEqual([
      expect.objectContaining({ comment_id: 201, manager_name: "鈴木一郎" }),
    ]);
    expect(findUniqueReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { report_id: 10 },
        include: expect.objectContaining({
          visit_records: expect.objectContaining({ orderBy: { visit_time: "asc" } }),
          comments: expect.objectContaining({ orderBy: { created_at: "asc" } }),
        }),
      }),
    );
  });
});

describe("PUT /api/reports/:id", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await PUT(
      putRequest({ report_date: "2026-08-25", status: "DRAFT", visit_records: [] }),
      ctx("10"),
    );
    expect(response.status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the report does not exist", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue(null as never);

    const response = await PUT(
      putRequest({ report_date: "2026-08-25", status: "DRAFT", visit_records: [] }),
      ctx("999"),
    );

    expect(response.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 403 when the caller is not the report's creator", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(TANAKA as never);
    findUniqueReportMock.mockResolvedValue({ sales_person_id: 1 } as never);

    const response = await PUT(
      putRequest({ report_date: "2026-08-25", status: "DRAFT", visit_records: [] }),
      ctx("10"),
    );

    expect(response.status).toBe(403);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 422 when SUBMITTED has no visit_records", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue({ sales_person_id: 1 } as never);

    const response = await PUT(
      putRequest({ report_date: "2026-08-25", status: "SUBMITTED", visit_records: [] }),
      ctx("10"),
    );

    expect(response.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 422 when visit_content exceeds 500 characters", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue({ sales_person_id: 1 } as never);

    const response = await PUT(
      putRequest({
        report_date: "2026-08-25",
        status: "SUBMITTED",
        visit_records: [{ customer_id: 1, visit_content: "訪".repeat(501) }],
      }),
      ctx("10"),
    );

    expect(response.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 422 when problem exceeds 1000 characters", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue({ sales_person_id: 1 } as never);

    const response = await PUT(
      putRequest({
        report_date: "2026-08-25",
        status: "DRAFT",
        problem: "問".repeat(1001),
        visit_records: [],
      }),
      ctx("10"),
    );

    expect(response.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("returns 409 when the changed report_date collides with another of the caller's reports", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue({ sales_person_id: 1 } as never);
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const response = await PUT(
      putRequest({
        report_date: "2026-08-24",
        status: "SUBMITTED",
        visit_records: [{ customer_id: 1, visit_content: "訪問" }],
      }),
      ctx("10"),
    );

    expect(response.status).toBe(409);
  });

  it("returns 422 when a visit_record references a non-existent customer_id", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue({ sales_person_id: 1 } as never);
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "7.9.1",
      }),
    );

    const response = await PUT(
      putRequest({
        report_date: "2026-08-25",
        status: "SUBMITTED",
        visit_records: [{ customer_id: 9999, visit_content: "訪問" }],
      }),
      ctx("10"),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("指定された顧客が見つかりません");
  });

  it("replaces visit_records wholesale (delete all, then create the new set)", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue({ sales_person_id: 1 } as never);
    updateMock.mockResolvedValue(
      buildReport({
        visit_records: [
          {
            visit_id: 101,
            customer_id: 1,
            customer: { company_name: "株式会社A社" },
            visit_content: "新商品の提案を実施",
            visit_time: new Date("1970-01-01T10:00:00.000Z"),
            created_at: new Date("2026-08-25T09:00:00.000Z"),
          },
        ],
      }) as never,
    );

    const response = await PUT(
      putRequest({
        report_date: "2026-08-25",
        status: "SUBMITTED",
        visit_records: [
          { customer_id: 1, visit_content: "新商品の提案を実施", visit_time: "10:00" },
        ],
      }),
      ctx("10"),
    );

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { report_id: 10 },
        data: expect.objectContaining({
          visit_records: {
            deleteMany: {},
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
    expect(body.visit_records).toHaveLength(1);
  });
});
