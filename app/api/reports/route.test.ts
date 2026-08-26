import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
      findUnique: vi.fn(),
    },
    dailyReport: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET } from "./route";

const findUniqueSalesPersonMock = vi.mocked(prisma.salesPerson.findUnique);
const findManyMock = vi.mocked(prisma.dailyReport.findMany);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
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

beforeEach(() => {
  findUniqueSalesPersonMock.mockReset();
  findManyMock.mockReset();
});

function getRequest(url: string, headers?: Record<string, string>): NextRequest {
  return new NextRequest(url, { headers: { "content-type": "application/json", ...headers } });
}

describe("GET /api/reports", () => {
  it("returns 401 when the auth header is missing", async () => {
    const response = await GET(getRequest("http://localhost/api/reports"));
    expect(response.status).toBe(401);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("scopes to the caller's own reports (both statuses) for a non-manager", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(YAMADA as never);
    findManyMock.mockResolvedValue([REPORT_10, REPORT_11] as never);

    const response = await GET(
      getRequest("http://localhost/api/reports", { "X-Sales-Person-Id": "1" }),
    );

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sales_person_id: 1 } }),
    );
    const body = await response.json();
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ report_id: 10, sales_person_name: "山田太郎", visit_count: 2 });
  });

  it("ignores the sales_person_id query for a non-manager", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(YAMADA as never);
    findManyMock.mockResolvedValue([REPORT_10] as never);

    await GET(
      getRequest("http://localhost/api/reports?sales_person_id=2", { "X-Sales-Person-Id": "1" }),
    );

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sales_person_id: 1 } }),
    );
  });

  it("scopes to SUBMITTED across all sales persons for a manager", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findManyMock.mockResolvedValue([REPORT_10] as never);

    const response = await GET(
      getRequest("http://localhost/api/reports", { "X-Sales-Person-Id": "5" }),
    );

    expect(response.status).toBe(200);
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "SUBMITTED" } }),
    );
    const body = await response.json();
    expect(body).toHaveLength(1);
    expect(body[0].report_id).toBe(10);
  });

  it("lets a manager filter by sales_person_id", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findManyMock.mockResolvedValue([REPORT_10] as never);

    await GET(
      getRequest("http://localhost/api/reports?sales_person_id=1", { "X-Sales-Person-Id": "5" }),
    );

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "SUBMITTED", sales_person_id: 1 } }),
    );
  });

  it("applies date_from/date_to filters", async () => {
    findUniqueSalesPersonMock.mockResolvedValue(YAMADA as never);
    findManyMock.mockResolvedValue([] as never);

    await GET(
      getRequest("http://localhost/api/reports?date_from=2026-08-25&date_to=2026-08-31", {
        "X-Sales-Person-Id": "1",
      }),
    );

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
