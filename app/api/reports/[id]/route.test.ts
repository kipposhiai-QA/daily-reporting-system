import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
      findUnique: vi.fn(),
    },
    dailyReport: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const findUniqueSalesPersonMock = vi.mocked(prisma.salesPerson.findUnique);
const findUniqueReportMock = vi.mocked(prisma.dailyReport.findUnique);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
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
  findUniqueSalesPersonMock.mockReset();
  findUniqueReportMock.mockReset();
});

function withAuthHeader(headers: Record<string, string> = {}): Record<string, string> {
  return { "X-Sales-Person-Id": "1", ...headers };
}

function makeRequest(headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/reports/10", {
    headers: { "content-type": "application/json", ...headers },
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/reports/:id", () => {
  it("returns 401 when the auth header is missing", async () => {
    const response = await GET(makeRequest(), ctx("10"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the report does not exist", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue(null as never);

    const response = await GET(makeRequest(withAuthHeader()), ctx("999"));
    expect(response.status).toBe(404);
  });

  it("allows the owner to access their own DRAFT report", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "DRAFT" }) as never);

    const response = await GET(makeRequest(withAuthHeader()), ctx("10"));
    expect(response.status).toBe(200);
  });

  it("denies another sales person from accessing a DRAFT report", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(TANAKA as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "DRAFT" }) as never);

    const response = await GET(
      makeRequest(withAuthHeader({ "X-Sales-Person-Id": "2" })),
      ctx("10"),
    );
    expect(response.status).toBe(403);
  });

  it("denies a manager from accessing another sales person's DRAFT report", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "DRAFT" }) as never);

    const response = await GET(
      makeRequest(withAuthHeader({ "X-Sales-Person-Id": "5" })),
      ctx("10"),
    );
    expect(response.status).toBe(403);
  });

  it("allows a manager to access another sales person's SUBMITTED report", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "SUBMITTED" }) as never);

    const response = await GET(
      makeRequest(withAuthHeader({ "X-Sales-Person-Id": "5" })),
      ctx("10"),
    );
    expect(response.status).toBe(200);
  });

  it("denies a non-manager, non-owner from accessing a SUBMITTED report", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(TANAKA as never);
    findUniqueReportMock.mockResolvedValue(buildReport({ status: "SUBMITTED" }) as never);

    const response = await GET(
      makeRequest(withAuthHeader({ "X-Sales-Person-Id": "2" })),
      ctx("10"),
    );
    expect(response.status).toBe(403);
  });

  it("returns visit records and comments in the documented shape and order", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(YAMADA as never);
    findUniqueReportMock.mockResolvedValue(buildReport() as never);

    const response = await GET(makeRequest(withAuthHeader()), ctx("10"));
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
