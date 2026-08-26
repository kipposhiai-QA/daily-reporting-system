// 疑似認証（X-Sales-Person-Id ヘッダー）の共通処理
// 参照: docs/api-specification.md 1.2 「現在のユーザー」の指定方法（認証代替）
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ApiError } from "./errors";

export const SALES_PERSON_ID_HEADER = "x-sales-person-id";

export interface CurrentSalesPerson {
  salesPersonId: number;
  isManager: boolean;
}

/**
 * X-Sales-Person-Id ヘッダーを読み取り、SALES_PERSON の存在確認を行う。
 * ヘッダー未指定・数値でない・該当レコードが存在しない場合はいずれも 401 UNAUTHENTICATED。
 * `GET /api/sales-persons` はこの関数を呼ばずに実装する（ヘッダー無しで呼び出し可能な例外のため）。
 */
export async function getCurrentSalesPerson(request: NextRequest): Promise<CurrentSalesPerson> {
  const headerValue = request.headers.get(SALES_PERSON_ID_HEADER);

  if (headerValue === null || headerValue.trim() === "") {
    throw new ApiError("UNAUTHENTICATED", "X-Sales-Person-Id ヘッダーが必要です");
  }

  const salesPersonId = Number(headerValue);
  if (!Number.isInteger(salesPersonId)) {
    throw new ApiError("UNAUTHENTICATED", "X-Sales-Person-Id ヘッダーの値が不正です");
  }

  const salesPerson = await prisma.salesPerson.findUnique({
    where: { sales_person_id: salesPersonId },
    select: { sales_person_id: true, is_manager: true },
  });

  if (!salesPerson) {
    throw new ApiError("UNAUTHENTICATED", "指定された営業担当者が存在しません");
  }

  return { salesPersonId: salesPerson.sales_person_id, isManager: salesPerson.is_manager };
}

/** 上長でなければ 403 FORBIDDEN。コメント投稿などマネージャー限定操作の入口で使う。 */
export function requireManager(current: CurrentSalesPerson): void {
  if (!current.isManager) {
    throw new ApiError("FORBIDDEN", "この操作には上長権限が必要です");
  }
}
