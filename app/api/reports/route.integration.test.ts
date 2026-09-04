// 結合テスト: 日報 API（一覧・作成）
// 参照: docs/test-specification.md 4.3 日報 API
// 認証: Supabase Authのログインセッションは getSalesPersonFromSession をモックして表現する
// （Issue #78 Stage 1/3でreports/commentsがセッションベース認証に移行したため）。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { getRequest, mockSalesPersonSession, postRequest } from "@/tests/integration/request";
import { GET, POST } from "./route";

const sessionMock = vi.mocked(getSalesPersonFromSession);

describe.skipIf(!hasTestDatabase())("結合テスト: /api/reports", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sessionMock.mockReset();
  });

  describe("GET /api/reports", () => {
    it("未ログインは拒否 (TC-API-RPT-01)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(undefined));

      const response = await GET(getRequest("http://localhost/api/reports"));

      expect(response.status).toBe(401);
    });

    it("営業は自分の分のみ（DRAFT含む） (TC-API-RPT-02)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await GET(getRequest("http://localhost/api/reports"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.map((report: { report_id: number }) => report.report_id).sort()).toEqual([
        10, 11,
      ]);
    });

    it("上長はSUBMITTEDのみ全員分 (TC-API-RPT-03)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(5));

      const response = await GET(getRequest("http://localhost/api/reports"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.map((report: { report_id: number }) => report.report_id)).toEqual([10]);
    });

    it("上長: sales_person_id絞り込み (TC-API-RPT-04)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(2));
      const otherSubmitted = await POST(
        postRequest("http://localhost/api/reports", {
          report_date: "2026-08-26",
          status: "SUBMITTED",
          visit_records: [{ customer_id: 1, visit_content: "訪問" }],
        }),
      );
      expect(otherSubmitted.status).toBe(201);

      sessionMock.mockResolvedValue(mockSalesPersonSession(5));
      const response = await GET(getRequest("http://localhost/api/reports?sales_person_id=1"));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.map((report: { sales_person_id: number }) => report.sales_person_id)).toEqual([
        1,
      ]);
    });
  });

  describe("POST /api/reports", () => {
    it("提出時の訪問記録必須 (TC-API-RPT-07)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await POST(
        postRequest("http://localhost/api/reports", {
          report_date: "2026-08-26",
          status: "SUBMITTED",
          visit_records: [],
        }),
      );

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("下書きは0件許可 (TC-API-RPT-08)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await POST(
        postRequest("http://localhost/api/reports", {
          report_date: "2026-08-26",
          status: "DRAFT",
          visit_records: [],
        }),
      );

      expect(response.status).toBe(201);
    });

    it("日付重複 (TC-API-RPT-09)", async () => {
      sessionMock.mockResolvedValue(mockSalesPersonSession(1));

      const response = await POST(
        postRequest("http://localhost/api/reports", {
          report_date: "2026-08-25",
          status: "DRAFT",
          visit_records: [],
        }),
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("CONFLICT");
    });
  });
});
