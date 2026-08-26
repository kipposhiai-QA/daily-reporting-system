import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCurrentSalesPerson, requireManager } from "./auth";
import { ApiError } from "./errors";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    salesPerson: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const findUniqueMock = vi.mocked(prisma.salesPerson.findUnique);

function requestWithHeader(value: string | undefined): NextRequest {
  const headers = new Headers();
  if (value !== undefined) {
    headers.set("X-Sales-Person-Id", value);
  }
  return new NextRequest("http://localhost/api/reports", { headers });
}

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe("getCurrentSalesPerson", () => {
  it("throws UNAUTHENTICATED when the header is missing", async () => {
    await expect(getCurrentSalesPerson(requestWithHeader(undefined))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    } satisfies Partial<ApiError>);
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("throws UNAUTHENTICATED when the header is not a number", async () => {
    await expect(getCurrentSalesPerson(requestWithHeader("abc"))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  });

  it("throws UNAUTHENTICATED when no matching sales person exists", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(getCurrentSalesPerson(requestWithHeader("999"))).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { sales_person_id: 999 },
      select: { sales_person_id: true, is_manager: true },
    });
  });

  it("returns the resolved sales person for a valid header", async () => {
    findUniqueMock.mockResolvedValue({
      sales_person_id: 5,
      is_manager: true,
    } as Awaited<ReturnType<typeof findUniqueMock>>);

    await expect(getCurrentSalesPerson(requestWithHeader("5"))).resolves.toEqual({
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
