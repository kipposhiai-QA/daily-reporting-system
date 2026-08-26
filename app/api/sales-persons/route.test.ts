import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { GET, POST } from "./route";

const findManyMock = vi.mocked(prisma.salesPerson.findMany);
const findUniqueMock = vi.mocked(prisma.salesPerson.findUnique);
const createMock = vi.mocked(prisma.salesPerson.create);

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: new Date("2026-08-01T09:00:00.000Z"),
  updated_at: new Date("2026-08-01T09:00:00.000Z"),
};

beforeEach(() => {
  findManyMock.mockReset();
  findUniqueMock.mockReset();
  createMock.mockReset();
});

function postRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/sales-persons", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("GET /api/sales-persons", () => {
  it("returns the list without requiring the auth header", async () => {
    findManyMock.mockResolvedValue([YAMADA] as never);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      {
        sales_person_id: 1,
        name: "山田太郎",
        email: "yamada@example.com",
        department: "営業1課",
        is_manager: false,
        created_at: "2026-08-01T18:00:00+09:00",
        updated_at: "2026-08-01T18:00:00+09:00",
      },
    ]);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/sales-persons", () => {
  it("returns 401 when the auth header is missing", async () => {
    const response = await POST(postRequest({ name: "田中花子", email: "tanaka@example.com" }));
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("defaults is_manager to false when omitted and returns 201", async () => {
    findUniqueMock.mockResolvedValue(YAMADA as never);
    createMock.mockResolvedValue({
      ...YAMADA,
      sales_person_id: 2,
      name: "田中花子",
      email: "tanaka@example.com",
      department: null,
    } as never);

    const response = await POST(
      postRequest({ name: "田中花子", email: "tanaka@example.com" }, { "X-Sales-Person-Id": "1" }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "田中花子", email: "tanaka@example.com", department: null, is_manager: false },
    });
    const body = await response.json();
    expect(body.is_manager).toBe(false);
  });

  it("returns 422 when required fields are missing", async () => {
    findUniqueMock.mockResolvedValue(YAMADA as never);

    const response = await POST(postRequest({}, { "X-Sales-Person-Id": "1" }));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const fields = body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it("returns 409 when the email is already in use", async () => {
    findUniqueMock.mockResolvedValue(YAMADA as never);
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const response = await POST(
      postRequest({ name: "山田太郎2", email: "yamada@example.com" }, { "X-Sales-Person-Id": "1" }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
  });
});
