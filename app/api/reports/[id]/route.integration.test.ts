// 結合テスト: 日報 API（詳細取得・更新）
// 参照: docs/test-specification.md 4.3 日報 API
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { authHeaders, ctx, getRequest, putRequest } from "@/tests/integration/request";
import { GET, PUT } from "./route";

describe.skipIf(!hasTestDatabase())("結合テスト: /api/reports/:id", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /api/reports/:id", () => {
    it("DRAFTへの他者アクセス拒否 (TC-API-RPT-05)", async () => {
      const response = await GET(
        getRequest("http://localhost/api/reports/11", authHeaders(5)),
        ctx("11"),
      );

      expect(response.status).toBe(403);
    });

    it("SUBMITTEDへの上長アクセス許可 (TC-API-RPT-06)", async () => {
      const response = await GET(
        getRequest("http://localhost/api/reports/10", authHeaders(5)),
        ctx("10"),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.visit_records).toHaveLength(2);
      expect(body.comments).toEqual([]);
    });
  });

  describe("PUT /api/reports/:id", () => {
    it("作成者以外の更新拒否 (TC-API-RPT-10)", async () => {
      const response = await PUT(
        putRequest(
          "http://localhost/api/reports/10",
          {
            report_date: "2026-08-25",
            status: "SUBMITTED",
            visit_records: [{ customer_id: 1, visit_content: "訪問" }],
          },
          authHeaders(2),
        ),
        ctx("10"),
      );

      expect(response.status).toBe(403);
    });

    it("訪問記録の全置換 (TC-API-RPT-11)", async () => {
      const response = await PUT(
        putRequest(
          "http://localhost/api/reports/10",
          {
            report_date: "2026-08-25",
            status: "SUBMITTED",
            visit_records: [
              { customer_id: 1, visit_content: "新商品の提案を実施", visit_time: "10:00" },
            ],
          },
          authHeaders(1),
        ),
        ctx("10"),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.visit_records).toHaveLength(1);
      expect(body.visit_records[0].customer_id).toBe(1);
    });
  });
});
