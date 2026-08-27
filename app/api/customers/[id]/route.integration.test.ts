// 結合テスト: 顧客マスタ API（削除）
// 参照: docs/test-specification.md 4.2 顧客マスタ API
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { authHeaders, ctx, deleteRequest } from "@/tests/integration/request";
import { DELETE } from "./route";

describe.skipIf(!hasTestDatabase())("結合テスト: /api/customers/:id", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("DELETE /api/customers/:id", () => {
    it("訪問記録から参照されている場合は削除できない (TC-API-CUST-03)", async () => {
      const response = await DELETE(
        deleteRequest("http://localhost/api/customers/1", authHeaders(1)),
        ctx("1"),
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("CONFLICT");
    });
  });
});
