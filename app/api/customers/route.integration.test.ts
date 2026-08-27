// 結合テスト: 顧客マスタ API（一覧・登録）
// 参照: docs/test-specification.md 4.2 顧客マスタ API
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { authHeaders, getRequest, postRequest } from "@/tests/integration/request";
import { GET, POST } from "./route";

describe.skipIf(!hasTestDatabase())("結合テスト: /api/customers", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /api/customers", () => {
    it("会社名の部分一致検索 (TC-API-CUST-01)", async () => {
      const response = await GET(
        getRequest("http://localhost/api/customers?company_name=A%E7%A4%BE", authHeaders(1)),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(1);
      expect(body[0].company_name).toBe("株式会社A社");
    });
  });

  describe("POST /api/customers", () => {
    it("必須項目欠如時は422になる (TC-API-CUST-02)", async () => {
      const response = await POST(
        postRequest("http://localhost/api/customers", {}, authHeaders(1)),
      );

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      const fields = body.error.details.map((detail: { field: string }) => detail.field);
      expect(fields).toEqual(expect.arrayContaining(["company_name"]));
    });
  });
});
