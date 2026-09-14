import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSalesPersonFromSession, requireManager } from "./auth";
import { ApiError } from "./errors";

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";

const getSalesPersonFromSessionMock = vi.mocked(getSalesPersonFromSession);

beforeEach(() => {
  getSalesPersonFromSessionMock.mockReset();
});

describe("getCurrentSalesPersonFromSession", () => {
  it("throws UNAUTHENTICATED when there is no Supabase Auth session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue(null);

    await expect(getCurrentSalesPersonFromSession()).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    } satisfies Partial<ApiError>);
  });

  it("returns the sales person resolved from the session", async () => {
    getSalesPersonFromSessionMock.mockResolvedValue({
      sales_person_id: 5,
      is_manager: true,
    } as Awaited<ReturnType<typeof getSalesPersonFromSessionMock>>);

    await expect(getCurrentSalesPersonFromSession()).resolves.toEqual({
      salesPersonId: 5,
      isManager: true,
    });
  });
});

describe("requireManager", () => {
  it("throws FORBIDDEN for a non-manager", () => {
    expect(() => requireManager({ salesPersonId: 1, isManager: false })).toThrow(ApiError);
    try {
      requireManager({ salesPersonId: 1, isManager: false });
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).code).toBe("FORBIDDEN");
    }
  });

  it("does not throw for a manager", () => {
    expect(() => requireManager({ salesPersonId: 5, isManager: true })).not.toThrow();
  });
});
