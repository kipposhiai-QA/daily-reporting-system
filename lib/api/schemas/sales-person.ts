// 営業マスタAPIのZodスキーマ・レスポンス変換
// 参照: docs/api-specification.md 3. 営業マスタ API
import { z } from "zod";
import { Prisma, type SalesPerson } from "@/generated/prisma/client";
import { formatDateTimeJst } from "@/lib/api/datetime";
import { ApiError } from "@/lib/api/errors";
import { registry } from "@/lib/api/openapi";

export const salesPersonResponseSchema = registry.register(
  "SalesPerson",
  z.object({
    sales_person_id: z.number().int().openapi({ example: 1 }),
    name: z.string().openapi({ example: "山田太郎" }),
    email: z.email().openapi({ example: "yamada@example.com" }),
    department: z.string().nullable().openapi({ example: "営業1課" }),
    is_manager: z.boolean().openapi({ example: false }),
    created_at: z.string().openapi({ example: "2026-08-01T09:00:00+09:00" }),
    updated_at: z.string().openapi({ example: "2026-08-01T09:00:00+09:00" }),
  }),
);

export type SalesPersonResponse = z.infer<typeof salesPersonResponseSchema>;

export function toSalesPersonResponse(salesPerson: SalesPerson): SalesPersonResponse {
  return {
    sales_person_id: salesPerson.sales_person_id,
    name: salesPerson.name,
    email: salesPerson.email,
    department: salesPerson.department,
    is_manager: salesPerson.is_manager,
    created_at: formatDateTimeJst(salesPerson.created_at),
    updated_at: formatDateTimeJst(salesPerson.updated_at),
  };
}

/** POST/PUT 共通のリクエストボディ。docs/api-specification.md 3.3 のバリデーション表に対応する。 */
export const salesPersonBodySchema = registry.register(
  "SalesPersonBody",
  z.object({
    name: z
      .string()
      .min(1, "氏名は必須です")
      .max(50, "氏名は50文字以内で入力してください")
      .openapi({ example: "山田太郎" }),
    email: z
      .string()
      .min(1, "メールアドレスは必須です")
      .email("メールアドレスの形式が不正です")
      .max(254, "メールアドレスは254文字以内で入力してください")
      .openapi({ example: "yamada@example.com" }),
    department: z
      .string()
      .max(100, "部署は100文字以内で入力してください")
      .nullable()
      .optional()
      .openapi({ example: "営業1課" }),
    is_manager: z.boolean().optional().openapi({ example: false }),
  }),
);

export type SalesPersonBody = z.infer<typeof salesPersonBodySchema>;

/**
 * 営業マスタ操作で発生しうるPrismaの制約違反エラーを共通エラー形式に変換して投げ直す。
 * P2002: email一意制約違反 / P2025: 対象レコード無し / P2003: 参照されているため削除不可。
 */
export function mapSalesPersonPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      throw new ApiError("CONFLICT", "このメールアドレスは既に使用されています");
    }
    if (error.code === "P2025") {
      throw new ApiError("NOT_FOUND", "指定された営業担当者が見つかりません");
    }
    if (error.code === "P2003") {
      throw new ApiError(
        "CONFLICT",
        "この営業担当者は日報またはコメントで使用されているため削除できません",
      );
    }
  }
  throw error;
}
