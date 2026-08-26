import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { DELETE, GET, PUT } from "./route";

const findUniqueMock = vi.mocked(prisma.salesPerson.findUnique);
const updateMock = vi.mocked(prisma.salesPerson.update);
const deleteMock = vi.mocked(prisma.salesPerson.delete);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: new Date("2026-08-01T09:00:00.000Z"),
  updated_at: new Date("2026-08-01T09:00:00.000Z"),
};

const CURRENT_USER = YAMADA;

beforeEach(() => {
  findUniqueMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
});

function withAuthHeader(headers: Record<string, string> = {}): Record<string, string> {
  return { "X-Sales-Person-Id": "1", ...headers };
}

function makeRequest(
  method: string,
  body?: unknown,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest("http://localhost/api/sales-persons/1", {
    method,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    headers: { "content-type": "application/json", ...headers },
  });
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/sales-persons/:id", () => {
  it("returns 401 when the auth header is missing", async () => {
    const response = await GET(makeRequest("GET"), ctx("1"));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the sales person does not exist", async () => {
    // first call resolves current user, second resolves target -> null
    findUniqueMock
      .mockResolvedValueOnce(CURRENT_USER as never)
      .mockResolvedValueOnce(null as never);

    const response = await GET(makeRequest("GET", undefined, withAuthHeader()), ctx("999"));
    expect(response.status).toBe(404);
  });

  it("returns 200 with the sales person detail", async () => {
    findUniqueMock
      .mockResolvedValueOnce(CURRENT_USER as never)
      .mockResolvedValueOnce(YAMADA as never);

    const response = await GET(makeRequest("GET", undefined, withAuthHeader()), ctx("1"));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sales_person_id).toBe(1);
    expect(body.created_at).toBe("2026-08-01T18:00:00+09:00");
  });
});

describe("PUT /api/sales-persons/:id", () => {
  it("returns 404 when updating a non-existent sales person", async () => {
    findUniqueMock.mockResolvedValueOnce(CURRENT_USER as never);
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Record not found", {
        code: "P2025",
        clientVersion: "7.9.1",
      }),
    );

    const response = await PUT(
      makeRequest("PUT", { name: "山田次郎", email: "yamada2@example.com" }, withAuthHeader()),
      ctx("999"),
    );

    expect(response.status).toBe(404);
  });

  it("returns 409 when the email collides with another record", async () => {
    findUniqueMock.mockResolvedValueOnce(CURRENT_USER as never);
    updateMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const response = await PUT(
      makeRequest("PUT", { name: "山田太郎", email: "tanaka@example.com" }, withAuthHeader()),
      ctx("1"),
    );

    expect(response.status).toBe(409);
  });

  it("updates and returns 200 on success", async () => {
    findUniqueMock.mockResolvedValueOnce(CURRENT_USER as never);
    updateMock.mockResolvedValue({ ...YAMADA, name: "山田次郎" } as never);

    const response = await PUT(
      makeRequest(
        "PUT",
        { name: "山田次郎", email: "yamada@example.com", department: "営業1課", is_manager: false },
        withAuthHeader(),
      ),
      ctx("1"),
    );

    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith({
      where: { sales_person_id: 1 },
      data: {
        name: "山田次郎",
        email: "yamada@example.com",
        department: "営業1課",
        is_manager: false,
      },
    });
  });
});

describe("DELETE /api/sales-persons/:id", () => {
  it("returns 409 when the sales person is referenced by reports or comments", async () => {
    findUniqueMock.mockResolvedValueOnce(CURRENT_USER as never);
    deleteMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
        code: "P2003",
        clientVersion: "7.9.1",
      }),
    );

    const response = await DELETE(makeRequest("DELETE", undefined, withAuthHeader()), ctx("1"));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.message).toBe(
      "この営業担当者は日報またはコメントで使用されているため削除できません",
    );
  });

  it("returns 204 on successful deletion", async () => {
    findUniqueMock.mockResolvedValueOnce(CURRENT_USER as never);
    deleteMock.mockResolvedValue(YAMADA as never);

    const response = await DELETE(makeRequest("DELETE", undefined, withAuthHeader()), ctx("2"));

    expect(response.status).toBe(204);
  });
});
