// Zodスキーマによるリクエスト検証の共通ユーティリティ
// 参照: docs/api-specification.md 1.4 共通エラーレスポンス形式（details はフィールド単位のバリデーションエラー時のみ付与）
import type { NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { ApiError, type ApiErrorDetail } from "./errors";

function zodErrorToDetails(error: ZodError): ApiErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "(root)",
    message: issue.message,
  }));
}

/** Zodスキーマでデータを検証し、失敗時は 422 VALIDATION_ERROR の ApiError を投げる。 */
export function parseWithSchema<Schema extends z.ZodType>(
  schema: Schema,
  data: unknown,
): z.infer<Schema> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "入力内容に誤りがあります",
      zodErrorToDetails(result.error),
    );
  }
  return result.data;
}

/** リクエストボディをJSONとして読み取り、Zodスキーマで検証する。 */
export async function parseJsonBody<Schema extends z.ZodType>(
  request: NextRequest,
  schema: Schema,
): Promise<z.infer<Schema>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "リクエストボディがJSON形式ではありません");
  }
  return parseWithSchema(schema, json);
}

/** クエリパラメータ（URLSearchParams）をオブジェクト化した上でZodスキーマで検証する。 */
export function parseSearchParams<Schema extends z.ZodType>(
  searchParams: URLSearchParams,
  schema: Schema,
): z.infer<Schema> {
  return parseWithSchema(schema, Object.fromEntries(searchParams.entries()));
}

/** 動的ルートの `:id` を数値に変換する。整数として解釈できない場合は 404 NOT_FOUND とする。 */
export function parseIdParam(value: string): number {
  const id = Number(value);
  if (!Number.isInteger(id)) {
    throw new ApiError("NOT_FOUND", "指定されたIDが見つかりません");
  }
  return id;
}
