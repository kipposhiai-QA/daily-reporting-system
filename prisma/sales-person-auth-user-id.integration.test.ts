// 結合テスト: SalesPerson.auth_user_id カラム
// 参照: Issue #58（Supabase Auth連携のための認証基盤を構築する）
//
// このIssueのスコープはPrismaスキーマへの auth_user_id カラム追加とマイグレーション適用のみで、
// API・疑似認証(lib/current-user-context.tsx, X-Sales-Person-Id)は変更しない。
// そのため、Prisma Client経由でカラムの読み書き・一意制約が機能することのみを確認する。
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vitest";
import { hasTestDatabase, resetTestDatabase } from "@/tests/integration/db";
import { prisma } from "@/lib/prisma";

describe.skipIf(!hasTestDatabase())("結合テスト: SalesPerson.auth_user_id", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("未設定の既存レコードはnullのまま取得できる", async () => {
    const salesPerson = await prisma.salesPerson.findUniqueOrThrow({
      where: { sales_person_id: 1 },
    });

    expect(salesPerson.auth_user_id).toBeNull();
  });

  it("auth_user_idを設定・取得できる", async () => {
    const authUserId = randomUUID();

    const updated = await prisma.salesPerson.update({
      where: { sales_person_id: 1 },
      data: { auth_user_id: authUserId },
    });

    expect(updated.auth_user_id).toBe(authUserId);
  });

  it("同一のauth_user_idを別レコードに設定すると一意制約違反になる", async () => {
    const authUserId = randomUUID();

    await prisma.salesPerson.update({
      where: { sales_person_id: 1 },
      data: { auth_user_id: authUserId },
    });

    await expect(
      prisma.salesPerson.update({
        where: { sales_person_id: 2 },
        data: { auth_user_id: authUserId },
      }),
    ).rejects.toThrow();
  });
});
