// 顧客マスタAPIのZodスキーマ・レスポンス変換
// 参照: docs/api-specification.md 4. 顧客マスタ API
import { z } from "zod";
import { Prisma, type Customer } from "@/generated/prisma/client";
import { formatDateTimeJst } from "@/lib/api/datetime";
import { ApiError } from "@/lib/api/errors";
import { registry } from "@/lib/api/openapi";

export const customerResponseSchema = registry.register(
  "Customer",
  z.object({
    customer_id: z.number().int().openapi({ example: 1 }),
    company_name: z.string().openapi({ example: "株式会社A社" }),
    contact_person: z.string().nullable().openapi({ example: "佐藤様" }),
    phone: z.string().nullable().openapi({ example: "03-1234-5678" }),
    email: z.string().nullable().openapi({ example: "sato@a-corp.example.com" }),
    address: z.string().nullable().openapi({ example: "東京都千代田区..." }),
    created_at: z.string().openapi({ example: "2026-08-01T09:00:00+09:00" }),
    updated_at: z.string().openapi({ example: "2026-08-01T09:00:00+09:00" }),
  }),
);

export type CustomerResponse = z.infer<typeof customerResponseSchema>;

export function toCustomerResponse(customer: Customer): CustomerResponse {
  return {
    customer_id: customer.customer_id,
    company_name: customer.company_name,
    contact_person: customer.contact_person,
    phone: customer.phone,
    email: customer.email,
    address: customer.address,
    created_at: formatDateTimeJst(customer.created_at),
    updated_at: formatDateTimeJst(customer.updated_at),
  };
}

/** POST/PUT 共通のリクエストボディ。docs/api-specification.md 4.3 のバリデーション表に対応する。 */
export const customerBodySchema = registry.register(
  "CustomerBody",
  z.object({
    company_name: z
      .string()
      .min(1, "会社名は必須です")
      .max(200, "会社名は200文字以内で入力してください")
      .openapi({ example: "株式会社A社" }),
    contact_person: z
      .string()
      .max(50, "担当者名は50文字以内で入力してください")
      .nullable()
      .optional()
      .openapi({ example: "佐藤様" }),
    phone: z
      .string()
      .max(20, "電話番号は20文字以内で入力してください")
      .nullable()
      .optional()
      .openapi({ example: "03-1234-5678" }),
    // メール形式のバリデーション(.email())は別Issue(#97)で対応する。
    email: z
      .string()
      .max(254, "メールアドレスは254文字以内で入力してください")
      .nullable()
      .optional()
      .openapi({ example: "sato@a-corp.example.com" }),
    address: z
      .string()
      .max(200, "住所は200文字以内で入力してください")
      .nullable()
      .optional()
      .openapi({ example: "東京都千代田区..." }),
  }),
);

export type CustomerBody = z.infer<typeof customerBodySchema>;

/** 一覧取得のクエリパラメータ（会社名の部分一致検索）。 */
export const customerListQuerySchema = registry.register(
  "CustomerListQuery",
  z.object({
    company_name: z.string().optional().openapi({ example: "A社" }),
  }),
);

/**
 * 顧客マスタ操作で発生しうるPrismaの制約違反エラーを共通エラー形式に変換して投げ直す。
 * P2025: 対象レコード無し / P2003: VISIT_RECORDから参照されているため削除不可。
 */
export function mapCustomerPrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      throw new ApiError("NOT_FOUND", "指定された顧客が見つかりません");
    }
    if (error.code === "P2003") {
      throw new ApiError("CONFLICT", "この顧客は訪問記録で使用されているため削除できません");
    }
  }
  throw error;
}
