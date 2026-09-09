import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

const inviteUserByEmail = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    auth: { admin: { inviteUserByEmail } },
  })),
}));

import { prisma } from "@/lib/prisma";
import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { POST } from "./route";

const getSalesPersonFromSessionMock = vi.mocked(getSalesPersonFromSession);
const createMock = vi.mocked(prisma.salesPerson.create);
const updateMock = vi.mocked(prisma.salesPerson.update);
const deleteMock = vi.mocked(prisma.salesPerson.delete);

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

const CREATED_SATO = {
  sales_person_id: 3,
  name: "佐藤次郎",
  email: "sato@example.com",
  department: null,
  is_manager: false,
  auth_user_id: null,
  created_at: new Date("2026-08-01T09:00:00.000Z"),
  updated_at: new Date("2026-08-01T09:00:00.000Z"),
};

beforeEach(() => {
  getSalesPersonFromSessionMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  inviteUserByEmail.mockReset();
});

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/sales-persons/invite", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/sales-persons/invite", () => {
  it("returns 401 when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await POST(postRequest({ name: "佐藤次郎", email: "sato@example.com" }));

    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("returns 422 when required fields are missing", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await POST(postRequest({}));

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(createMock).not.toHaveBeenCalled();
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it.each(["notanemail", "foo@", "@example.com"])(
    "returns 422 when the email is malformed (%s), without calling the Admin API",
    async (email) => {
      getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

      const response = await POST(postRequest({ name: "佐藤次郎", email }));

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      const fields = body.error.details.map((d: { field: string }) => d.field);
      expect(fields).toEqual(expect.arrayContaining(["email"]));
      expect(createMock).not.toHaveBeenCalled();
      expect(inviteUserByEmail).not.toHaveBeenCalled();
    },
  );

  it("returns 409 without calling the Admin API when the email is already used by a SalesPerson", async () => {
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
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("creates the SalesPerson, invites via Supabase Admin API, and links auth_user_id (201)", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockResolvedValue(CREATED_SATO as never);
    inviteUserByEmail.mockResolvedValue({
      data: { user: { id: "22222222-2222-2222-2222-222222222222" } },
      error: null,
    });
    updateMock.mockResolvedValue({
      ...CREATED_SATO,
      auth_user_id: "22222222-2222-2222-2222-222222222222",
    } as never);

    const response = await POST(
      postRequest({ name: "佐藤次郎", email: "sato@example.com", department: null }),
    );

    expect(response.status).toBe(201);
    expect(createMock).toHaveBeenCalledWith({
      data: { name: "佐藤次郎", email: "sato@example.com", department: null, is_manager: false },
    });
    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "sato@example.com",
      expect.objectContaining({ redirectTo: expect.stringContaining("/reset-password/confirm") }),
    );
    expect(updateMock).toHaveBeenCalledWith({
      where: { sales_person_id: 3 },
      data: { auth_user_id: "22222222-2222-2222-2222-222222222222" },
    });
    expect(deleteMock).not.toHaveBeenCalled();
    const responseBody = await response.json();
    expect(responseBody.sales_person_id).toBe(3);
  });

  it("rolls back the created SalesPerson when the Admin API invite fails", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);
    createMock.mockResolvedValue(CREATED_SATO as never);
    inviteUserByEmail.mockResolvedValue({
      data: { user: null },
      error: {
        name: "AuthApiError",
        message: "A user with this email address has already been registered",
      },
    });
    deleteMock.mockResolvedValue(CREATED_SATO as never);

    const response = await POST(postRequest({ name: "佐藤次郎", email: "sato@example.com" }));

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("CONFLICT");
    expect(deleteMock).toHaveBeenCalledWith({ where: { sales_person_id: 3 } });
    expect(updateMock).not.toHaveBeenCalled();
  });
});
