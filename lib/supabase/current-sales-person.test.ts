import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { salesPerson: { findUnique: vi.fn() } },
}));

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getSalesPersonFromSession } from "./current-sales-person";

const createClientMock = vi.mocked(createClient);
const findUniqueMock = vi.mocked(prisma.salesPerson.findUnique);

function mockSupabaseUser(user: { id: string } | null) {
  createClientMock.mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
  } as never);
}

beforeEach(() => {
  createClientMock.mockReset();
  findUniqueMock.mockReset();
});

describe("getSalesPersonFromSession", () => {
  it("returns null when there is no Supabase session", async () => {
    mockSupabaseUser(null);

    const result = await getSalesPersonFromSession();

    expect(result).toBeNull();
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("resolves the SalesPerson by auth_user_id", async () => {
    mockSupabaseUser({ id: "11111111-1111-1111-1111-111111111111" });
    const YAMADA = { sales_person_id: 1, name: "山田太郎" };
    findUniqueMock.mockResolvedValue(YAMADA as never);

    const result = await getSalesPersonFromSession();

    expect(result).toEqual(YAMADA);
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { auth_user_id: "11111111-1111-1111-1111-111111111111" },
    });
  });

  it("returns null when no SalesPerson matches the auth_user_id", async () => {
    mockSupabaseUser({ id: "22222222-2222-2222-2222-222222222222" });
    findUniqueMock.mockResolvedValue(null);

    const result = await getSalesPersonFromSession();

    expect(result).toBeNull();
  });
});
