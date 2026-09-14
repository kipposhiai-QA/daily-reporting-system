// 結合テスト: 日報 API（詳細取得・更新）
// 参照: docs/test-specification.md 4.3 日報 API
// 認証: Supabase Authのログインセッションは getSalesPersonFromSession をモックして表現する
// （Issue #78 Stage 1/3でreports/commentsがセッションベース認証に移行したため）。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { ctx, getRequest, mockSalesPersonSession, putRequest } from "@/tests/integration/request";
import { GET, PUT } from "./route";

const sessionMock = vi.mocked(getSalesPersonFromSession);

describe.skipIf(!hasTestDatabase())("結合テスト: /api/reports/:id", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sessionMock.mockReset();
  });

  describe("GET /api/reports/:id", () => {
    it("DRAFTへの他者アクセス拒否 (TC-API-RPT-05)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(5));

      const response = await GET(getRequest("http://localhost/api/reports/11"), ctx("11"));

      expect(response.status).toBe(403);
    });

    it("SUBMITTEDへの上長アクセス許可 (TC-API-RPT-06)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(5));

      const response = await GET(getRequest("http://localhost/api/reports/10"), ctx("10"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.visit_records).toHaveLength(2);
      expect(body.comments).toEqual([]);
    });
  });

  describe("PUT /api/reports/:id", () => {
    it("作成者以外の更新拒否 (TC-API-RPT-10)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(2));

      const response = await PUT(
        putRequest("http://localhost/api/reports/10", {
          report_date: "2026-08-25",
          status: "SUBMITTED",
          visit_records: [{ customer_id: 1, visit_content: "訪問" }],
        }),
        ctx("10"),
      );

      expect(response.status).toBe(403);
    });

    it("訪問記録の全置換 (TC-API-RPT-11)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await PUT(
        putRequest("http://localhost/api/reports/10", {
          report_date: "2026-08-25",
          status: "SUBMITTED",
          visit_records: [
            { customer_id: 1, visit_content: "新商品の提案を実施", visit_time: "10:00" },
          ],
        }),
        ctx("10"),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.visit_records).toHaveLength(1);
      expect(body.visit_records[0].customer_id).toBe(1);
    });

    it("存在しないcustomer_idを指定した場合 (Issue #92)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await PUT(
        putRequest("http://localhost/api/reports/10", {
          report_date: "2026-08-25",
          status: "SUBMITTED",
          visit_records: [{ customer_id: 9999, visit_content: "訪問" }],
        }),
        ctx("10"),
      );

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.message).toBe("指定された顧客が見つかりません");
    });
  });
});
