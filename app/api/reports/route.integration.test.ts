// 結合テスト: 日報 API（一覧・作成）
// 参照: docs/test-specification.md 4.3 日報 API
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { authHeaders, getRequest, postRequest } from "@/tests/integration/request";
import { GET, POST } from "./route";

describe.skipIf(!hasTestDatabase())("結合テスト: /api/reports", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /api/reports", () => {
    it("ヘッダー必須 (TC-API-RPT-01)", async () => {
      const response = await GET(getRequest("http://localhost/api/reports"));

      expect(response.status).toBe(401);
    });

    it("営業は自分の分のみ（DRAFT含む） (TC-API-RPT-02)", async () => {
      const response = await GET(getRequest("http://localhost/api/reports", authHeaders(1)));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.map((report: { report_id: number }) => report.report_id).sort()).toEqual([
        10, 11,
      ]);
    });

    it("上長はSUBMITTEDのみ全員分 (TC-API-RPT-03)", async () => {
      const response = await GET(getRequest("http://localhost/api/reports", authHeaders(5)));

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.map((report: { report_id: number }) => report.report_id)).toEqual([10]);
    });

    it("上長: sales_person_id絞り込み (TC-API-RPT-04)", async () => {
      const otherSubmitted = await POST(
        postRequest(
          "http://localhost/api/reports",
          {
            report_date: "2026-08-26",
            status: "SUBMITTED",
            visit_records: [{ customer_id: 1, visit_content: "訪問" }],
          },
          authHeaders(2),
        ),
      );
      expect(otherSubmitted.status).toBe(201);

      const response = await GET(
        getRequest("http://localhost/api/reports?sales_person_id=1", authHeaders(5)),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.map((report: { sales_person_id: number }) => report.sales_person_id)).toEqual([
        1,
      ]);
    });
  });

  describe("POST /api/reports", () => {
    it("提出時の訪問記録必須 (TC-API-RPT-07)", async () => {
      const response = await POST(
        postRequest(
          "http://localhost/api/reports",
          { report_date: "2026-08-26", status: "SUBMITTED", visit_records: [] },
          authHeaders(1),
        ),
      );

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
    });

    it("下書きは0件許可 (TC-API-RPT-08)", async () => {
      const response = await POST(
        postRequest(
          "http://localhost/api/reports",
          { report_date: "2026-08-26", status: "DRAFT", visit_records: [] },
          authHeaders(1),
        ),
      );

      expect(response.status).toBe(201);
    });

    it("日付重複 (TC-API-RPT-09)", async () => {
      const response = await POST(
        postRequest(
          "http://localhost/api/reports",
          { report_date: "2026-08-25", status: "DRAFT", visit_records: [] },
          authHeaders(1),
        ),
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("CONFLICT");
    });
  });
});
