import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { GET } from "./route";

const getSalesPersonFromSessionMock = vi.mocked(getSalesPersonFromSession);

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
});

describe("GET /api/auth/me", () => {
  it("returns the sales person resolved from the Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(YAMADA as never);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      sales_person_id: 1,
      name: "山田太郎",
      email: "yamada@example.com",
      department: "営業1課",
      is_manager: false,
      created_at: "2026-08-01T18:00:00+09:00",
      updated_at: "2026-08-01T18:00:00+09:00",
    });
  });

  it("returns 401 when the session cannot be resolved to a sales person", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });
});
