import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    dailyReport: {
      findUnique: vi.fn(),
    },
    managerComment: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { prisma } from "@/lib/prisma";
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { POST } from "./route";

const getSalesPersonFromSessionMock = vi.mocked(getSalesPersonFromSession);
const findUniqueReportMock = vi.mocked(prisma.dailyReport.findUnique);
const createCommentMock = vi.mocked(prisma.managerComment.create);

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

const CREATED_COMMENT = {
  comment_id: 201,
  report_id: 10,
  manager_id: 5,
  manager: { name: "鈴木一郎" },
  comment: "見積もりの件、私からも確認します",
  created_at: new Date("2026-08-25T10:10:00.000Z"),
};

beforeEach(() => {
  getSalesPersonFromSessionMock.mockReset();
  findUniqueReportMock.mockReset();
  createCommentMock.mockReset();
});

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/reports/10/comments", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/reports/:id/comments", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await POST(postRequest({ comment: "確認します" }), ctx("10"));
    expect(response.status).toBe(401);
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it("returns 403 when a non-manager tries to comment (TC-API-CMT-01)", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await POST(postRequest({ comment: "確認します" }), ctx("10"));

    expect(response.status).toBe(403);
    expect(findUniqueReportMock).not.toHaveBeenCalled();
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the report does not exist", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue(null as never);

    const response = await POST(postRequest({ comment: "確認します" }), ctx("999"));

    expect(response.status).toBe(404);
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it("returns 403 when a manager comments on a DRAFT report (TC-API-CMT-02)", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue({ status: "DRAFT" } as never);

    const response = await POST(postRequest({ comment: "確認します" }), ctx("11"));

    expect(response.status).toBe(403);
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it("returns 422 when comment is missing (TC-API-CMT-04)", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue({ status: "SUBMITTED" } as never);

    const response = await POST(postRequest({}), ctx("10"));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it("returns 422 when comment exceeds 1000 characters", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue({ status: "SUBMITTED" } as never);

    const response = await POST(postRequest({ comment: "確".repeat(1001) }), ctx("10"));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createCommentMock).not.toHaveBeenCalled();
  });

  it("accepts a comment at the 1000 character max length boundary and returns 201", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue({ status: "SUBMITTED" } as never);
    const comment = "確".repeat(1000);
    createCommentMock.mockResolvedValue({ ...CREATED_COMMENT, comment } as never);

    const response = await POST(postRequest({ comment }), ctx("10"));

    expect(response.status).toBe(201);
    expect(createCommentMock).toHaveBeenCalledWith({
      data: { report_id: 10, manager_id: 5, comment },
      include: { manager: { select: { name: true } } },
    });
  });

  it("creates a comment on a SUBMITTED report and returns 201 (TC-API-CMT-03)", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(SUZUKI_MANAGER as never);
    findUniqueReportMock.mockResolvedValue({ status: "SUBMITTED" } as never);
    createCommentMock.mockResolvedValue(CREATED_COMMENT as never);

    const response = await POST(
      postRequest({ comment: "見積もりの件、私からも確認します" }),
      ctx("10"),
    );

    expect(response.status).toBe(201);
    expect(createCommentMock).toHaveBeenCalledWith({
      data: { report_id: 10, manager_id: 5, comment: "見積もりの件、私からも確認します" },
      include: { manager: { select: { name: true } } },
    });
    const body = await response.json();
    expect(body).toEqual({
      comment_id: 201,
      report_id: 10,
      manager_id: 5,
      manager_name: "鈴木一郎",
      comment: "見積もりの件、私からも確認します",
      created_at: "2026-08-25T19:10:00+09:00",
    });
  });
});
