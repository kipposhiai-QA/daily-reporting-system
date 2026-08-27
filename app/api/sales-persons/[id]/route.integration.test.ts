// 結合テスト: 営業マスタ API（削除）
// 参照: docs/test-specification.md 4.1 営業マスタ API
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { authHeaders, ctx, deleteRequest } from "@/tests/integration/request";
import { DELETE } from "./route";

describe.skipIf(!hasTestDatabase())("結合テスト: /api/sales-persons/:id", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("DELETE /api/sales-persons/:id", () => {
    it("日報から参照されている場合は削除できない (TC-API-SP-05)", async () => {
      const response = await DELETE(
        deleteRequest("http://localhost/api/sales-persons/1", authHeaders(1)),
        ctx("1"),
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    it("参照されていない営業担当者は削除できる (TC-API-SP-06)", async () => {
      const response = await DELETE(
        deleteRequest("http://localhost/api/sales-persons/2", authHeaders(1)),
        ctx("2"),
      );

      expect(response.status).toBe(204);
    });
  });
});
