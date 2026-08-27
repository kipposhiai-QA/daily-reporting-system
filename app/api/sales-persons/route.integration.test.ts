// 結合テスト: 営業マスタ API（一覧・登録）
// 参照: docs/test-specification.md 4.1 営業マスタ API
//
// テスト用DB（TEST_DATABASE_URL）が設定されている場合のみ実行する。
// 詳細は tests/integration/db.ts / docs/test-specification.md 2.1 を参照。
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { authHeaders, postRequest } from "@/tests/integration/request";
import { GET, POST } from "./route";

describe.skipIf(!hasTestDatabase())("結合テスト: /api/sales-persons", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  describe("GET /api/sales-persons", () => {
    it("ヘッダー無しでも一覧取得できる (TC-API-SP-01)", async () => {
      const response = await GET();

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body).toHaveLength(3);
      expect(body.map((p: { name: string }) => p.name).sort()).toEqual(
        ["山田太郎", "田中花子", "鈴木一郎"].sort(),
      );
    });
  });

  describe("POST /api/sales-persons", () => {
    it("is_manager省略時はfalseで登録される (TC-API-SP-02)", async () => {
      const response = await POST(
        postRequest(
          "http://localhost/api/sales-persons",
          { name: "佐藤次郎", email: "sato@example.com" },
          authHeaders(1),
        ),
      );

      expect(response.status).toBe(201);
      const body = await response.json();
      expect(body.is_manager).toBe(false);
    });

    it("メール重複時は409になる (TC-API-SP-03)", async () => {
      const response = await POST(
        postRequest(
          "http://localhost/api/sales-persons",
          { name: "山田太郎2", email: "yamada@example.com" },
          authHeaders(1),
        ),
      );

      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body.error.code).toBe("CONFLICT");
    });

    it("必須項目欠如時は422になる (TC-API-SP-04)", async () => {
      const response = await POST(
        postRequest("http://localhost/api/sales-persons", {}, authHeaders(1)),
      );

      expect(response.status).toBe(422);
      const body = await response.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      const fields = body.error.details.map((detail: { field: string }) => detail.field);
      expect(fields).toEqual(expect.arrayContaining(["name", "email"]));
    });
  });
});
