// OpenAPIドキュメント生成の土台
// 参照: docs/api-specification.md（APIスキーマ定義はZodスキーマから生成する）
// 各エンドポイントのスキーマ定義（#5〜#8）は、この registry に registerPath していく想定。
import { extendZodWithOpenApi, OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

const errorCodeSchema = z
  .enum(["UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "VALIDATION_ERROR"])
  .openapi("ErrorCode");

const errorDetailSchema = registry.register(
  "ErrorDetail",
  z.object({
    field: z.string().openapi({ example: "email" }),
    message: z.string().openapi({ example: "メールアドレスは必須です" }),
  }),
);

/** 共通エラーレスポンス（docs/api-specification.md 1.4）に対応するスキーマ。 */
export const errorResponseSchema = registry.register(
  "Error",
  z.object({
    error: z.object({
      code: errorCodeSchema,
      message: z.string().openapi({ example: "入力内容に誤りがあります" }),
      details: z.array(errorDetailSchema).optional(),
    }),
  }),
);

/** 疑似認証ヘッダー（docs/api-specification.md 1.2）。各エンドポイントのrequest.headersで参照する。 */
export const salesPersonIdHeaderParam = registry.registerParameter(
  "SalesPersonIdHeader",
  z.string().openapi({
    param: {
      name: "X-Sales-Person-Id",
      in: "header",
      required: true,
    },
    example: "1",
  }),
);
