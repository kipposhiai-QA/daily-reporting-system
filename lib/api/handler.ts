// APIルートハンドラの共通エラーハンドリング
// ApiError / ZodError を捕捉し、docs/api-specification.md 1.4 の形式に変換する。
// 各エンドポイントの route.ts は、この withApiHandler でラップしたハンドラをエクスポートする想定。
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiErrorResponse, ApiError, type ApiErrorBody } from "./errors";

type RouteHandler<Args extends unknown[]> = (...args: Args) => Promise<NextResponse>;

function zodErrorToApiError(error: ZodError): ApiError {
  return new ApiError(
    "VALIDATION_ERROR",
    "入力内容に誤りがあります",
    error.issues.map((issue) => ({
      field: issue.path.length > 0 ? issue.path.join(".") : "(root)",
      message: issue.message,
    })),
  );
}

export function withApiHandler<Args extends unknown[]>(
  handler: RouteHandler<Args>,
): (...args: Args) => Promise<NextResponse<ApiErrorBody> | NextResponse> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return apiErrorResponse(error);
      }
      if (error instanceof ZodError) {
        return apiErrorResponse(zodErrorToApiError(error));
      }
      console.error(error);
      return NextResponse.json(
        { error: { code: "INTERNAL_ERROR", message: "サーバー内部でエラーが発生しました" } },
        { status: 500 },
      );
    }
  };
}
