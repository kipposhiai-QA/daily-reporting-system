// 結合テスト: コメント API
// 参照: docs/test-specification.md 4.4 コメント API
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { authHeaders, ctx, postRequest } from "@/tests/integration/request";
import { POST } from "./route";

describe.skipIf(!hasTestDatabase())("結合テスト: /api/reports/:id/comments", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("営業によるコメント拒否 (TC-API-CMT-01)", async () => {
    const response = await POST(
      postRequest(
        "http://localhost/api/reports/10/comments",
        { comment: "確認します" },
        authHeaders(1),
      ),
      ctx("10"),
    );

    expect(response.status).toBe(403);
  });

  it("DRAFTへのコメント拒否 (TC-API-CMT-02)", async () => {
    const response = await POST(
      postRequest(
        "http://localhost/api/reports/11/comments",
        { comment: "確認します" },
        authHeaders(5),
      ),
      ctx("11"),
    );

    expect(response.status).toBe(403);
  });

  it("上長のコメント投稿成功 (TC-API-CMT-03)", async () => {
    const response = await POST(
      postRequest(
        "http://localhost/api/reports/10/comments",
        { comment: "確認します" },
        authHeaders(5),
      ),
      ctx("10"),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.manager_name).toBe("鈴木一郎");
    expect(body.comment).toBe("確認します");
  });

  it("必須項目欠如 (TC-API-CMT-04)", async () => {
    const response = await POST(
      postRequest("http://localhost/api/reports/10/comments", {}, authHeaders(5)),
      ctx("10"),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
