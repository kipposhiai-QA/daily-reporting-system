// 結合テスト: 顧客マスタ API（削除）
// 参照: docs/test-specification.md 4.2 顧客マスタ API
// 認証: Supabase Authのログインセッションは getSalesPersonFromSession をモックして表現する
// （Issue #78 Stage 3/3でcustomersがセッションベース認証に移行したため）。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { ctx, deleteRequest, mockSalesPersonSession } from "@/tests/integration/request";
import { DELETE } from "./route";

const sessionMock = vi.mocked(getSalesPersonFromSession);

describe.skipIf(!hasTestDatabase())("結合テスト: /api/customers/:id", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sessionMock.mockReset();
  });

  describe("DELETE /api/customers/:id", () => {
    it("訪問記録から参照されている場合は削除できない (TC-API-CUST-03)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await DELETE(deleteRequest("http://localhost/api/customers/1"), ctx("1"));

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("CONFLICT");
    });
  });
});
