// 結合テスト: 営業マスタ API（削除）
// 参照: docs/test-specification.md 4.1 営業マスタ API
// 認証: Supabase Authのログインセッションは getSalesPersonFromSession をモックして表現する
// （Issue #78 Stage 2/3でsales-personsがセッションベース認証に移行したため）。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { ctx, deleteRequest, mockSalesPersonSession } from "@/tests/integration/request";
import { DELETE } from "./route";

const sessionMock = vi.mocked(getSalesPersonFromSession);

describe.skipIf(!hasTestDatabase())("結合テスト: /api/sales-persons/:id", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sessionMock.mockReset();
  });

  describe("DELETE /api/sales-persons/:id", () => {
    it("日報から参照されている場合は削除できない (TC-API-SP-05)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await DELETE(
        deleteRequest("http://localhost/api/sales-persons/1"),
        ctx("1"),
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    it("参照されていない営業担当者は削除できる (TC-API-SP-06)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await DELETE(
        deleteRequest("http://localhost/api/sales-persons/2"),
        ctx("2"),
      );

      expect(response.status).toBe(204);
    });
  });
});
