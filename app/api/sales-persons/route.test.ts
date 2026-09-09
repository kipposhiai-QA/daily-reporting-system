import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
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
const findManyMock = vi.mocked(prisma.salesPerson.findMany);
const createMock = vi.mocked(prisma.salesPerson.create);

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

beforeEach(() => {
  getSalesPersonFromSessionMock.mockReset();
  findManyMock.mockReset();
  createMock.mockReset();
});

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sales-persons", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET /api/sales-persons", () => {
  it("returns the list without requiring a Supabase Auth session", async () => {
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
    expect(getSalesPersonFromSessionMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/sales-persons", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await POST(postRequest({ name: "田中花子", email: "tanaka@example.com" }));
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it("defaults is_manager to false when omitted and returns 201", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockResolvedValue({
      ...YAMADA,
      sales_person_id: 2,
      name: "田中花子",
      email: "tanaka@example.com",
      department: null,
    } as never);

    const response = await POST(postRequest({ name: "田中花子", email: "tanaka@example.com" }));

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "田中花子", email: "tanaka@example.com", department: null, is_manager: false },
    });
    const body = await response.json();
    expect(body.is_manager).toBe(false);
  });

  it("returns 422 when required fields are missing", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await POST(postRequest({}));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    const fields = body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(["name", "email"]));
  });

  it.each(["notanemail", "foo@", "@example.com"])(
    "returns 422 when the email is malformed (%s)",
    async (email) => {
      getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

      const response = await POST(postRequest({ name: "田中花子", email }));

      expect(response.status).toBe(422);
      expect(createMock).not.toHaveBeenCalled();
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      const fields = body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(["email"]));
    },
  );

  it("returns 409 when the email is already in use", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "7.9.1",
      }),
    );

    const response = await POST(postRequest({ name: "山田太郎2", email: "yamada@example.com" }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
  });
});
