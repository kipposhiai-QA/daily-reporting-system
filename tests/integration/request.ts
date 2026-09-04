// APIエンドポイントの結合テスト共通のNextRequestビルダー。
import { NextRequest } from "next/server";
import type { SalesPerson } from "@/generated/prisma/client";

/**
 * @deprecated X-Sales-Person-Id ヘッダーは移行が完了していないルート（customers/sales-persons、
 * Issue #78 Stage 2/3）でのみ使う。移行済みのルート（reports/comments）は
 * mockSalesPersonSession（このファイル）で Supabase Authセッションをモックすること。
 */
export function authHeaders(salesPersonId?: number): Record<string, string> {
  return salesPersonId === undefined ? {} : { "X-Sales-Person-Id": String(salesPersonId) };
}

/**
 * docs/test-specification.md 2.2 共通シードデータの sales_person_id → SalesPerson。
 * getSalesPersonFromSession() のモック戻り値を組み立てるのに使う。
 * lib/api/auth.ts の getCurrentSalesPersonFromSession は sales_person_id / is_manager
 * の2フィールドしか読まないため、他のフィールドはダミー値で埋める。
 */
const SEED_SALES_PERSONS: Record<number, SalesPerson> = {
  1: {
    sales_person_id: 1,
    name: "山田太郎",
    email: "yamada@example.com",
    department: "営業1課",
    is_manager: false,
    auth_user_id: null,
    created_at: new Date("2026-08-01T09:00:00.000Z"),
    updated_at: new Date("2026-08-01T09:00:00.000Z"),
  },
  2: {
    sales_person_id: 2,
    name: "田中花子",
    email: "tanaka@example.com",
    department: "営業2課",
    is_manager: false,
    auth_user_id: null,
    created_at: new Date("2026-08-01T09:00:00.000Z"),
    updated_at: new Date("2026-08-01T09:00:00.000Z"),
  },
  5: {
    sales_person_id: 5,
    name: "鈴木一郎",
    email: "suzuki@example.com",
    department: "営業1課",
    is_manager: true,
    auth_user_id: null,
    created_at: new Date("2026-08-01T09:00:00.000Z"),
    updated_at: new Date("2026-08-01T09:00:00.000Z"),
  },
};

/**
 * Supabase Authセッションから解決される営業担当者のモック値を組み立てる。
 * 呼び出し側で `vi.mock("@/lib/supabase/current-sales-person", () => ({
 * getSalesPersonFromSession: vi.fn() }))` した上で、
 * `vi.mocked(getSalesPersonFromSession).mockResolvedValue(mockSalesPersonSession(1))` のように使う。
 * 未ログイン状態を表す場合は salesPersonId を省略する（401を検証するテスト用）。
 */
export function mockSalesPersonSession(salesPersonId?: number): SalesPerson | null {
  if (salesPersonId === undefined) return null;
  const record = SEED_SALES_PERSONS[salesPersonId];
  if (!record) {
    throw new Error(`tests/integration/request.ts: 未知の sales_person_id です: ${salesPersonId}`);
  }
  return record;
}

export function getRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers: { "content-type": "application/json", ...headers } });
}

export function postRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

export function putRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

export function deleteRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...headers },
  });
}

export function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}
