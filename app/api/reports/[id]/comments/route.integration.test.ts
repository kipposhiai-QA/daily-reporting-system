// 結合テスト: コメント API
// 参照: docs/test-specification.md 4.4 コメント API
// 認証: Supabase Authのログインセッションは getSalesPersonFromSession をモックして表現する
// （Issue #78 Stage 1/3でreports/commentsがセッションベース認証に移行したため）。
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/current-sales-person", () => ({
  getSalesPersonFromSession: vi.fn(),
}));

import { getSalesPersonFromSession } from "@/lib/supabase/current-sales-person";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { ctx, mockSalesPersonSession, postRequest } from "@/tests/integration/request";
import { POST } from "./route";

const sessionMock = vi.mocked(getSalesPersonFromSession);

describe.skipIf(!hasTestDatabase())("結合テスト: /api/reports/:id/comments", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    sessionMock.mockReset();
  });

  it("営業によるコメント拒否 (TC-API-CMT-01)", async () => {
    sessionMock.mockResolvedValue(mockSalesPersonSession(1));

    const response = await POST(
      postRequest("http://localhost/api/reports/10/comments", { comment: "確認します" }),
      ctx("10"),
    );

    expect(response.status).toBe(403);
  });

  it("DRAFTへのコメント拒否 (TC-API-CMT-02)", async () => {
    sessionMock.mockResolvedValue(mockSalesPersonSession(5));

    const response = await POST(
      postRequest("http://localhost/api/reports/11/comments", { comment: "確認します" }),
      ctx("11"),
    );

    expect(response.status).toBe(403);
  });

  it("上長のコメント投稿成功 (TC-API-CMT-03)", async () => {
    sessionMock.mockResolvedValue(mockSalesPersonSession(5));

    const response = await POST(
      postRequest("http://localhost/api/reports/10/comments", { comment: "確認します" }),
      ctx("10"),
    );

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.manager_name).toBe("鈴木一郎");
    expect(body.comment).toBe("確認します");
  });

  it("必須項目欠如 (TC-API-CMT-04)", async () => {
    sessionMock.mockResolvedValue(mockSalesPersonSession(5));

    const response = await POST(
      postRequest("http://localhost/api/reports/10/comments", {}),
      ctx("10"),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("コメントが1000文字を超える場合は422になる (Issue #96)", async () => {
    sessionMock.mockResolvedValue(mockSalesPersonSession(5));

    const response = await POST(
      postRequest("http://localhost/api/reports/10/comments", { comment: "確".repeat(1001) }),
      ctx("10"),
    );

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });
});
