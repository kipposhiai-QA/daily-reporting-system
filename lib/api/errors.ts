// API共通エラー型・エラーレスポンス組み立てユーティリティ
// 参照: docs/api-specification.md 1.3 権限エラーの扱い / 1.4 共通エラーレスポンス形式
import { NextResponse } from "next/server";

export type ErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "VALIDATION_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION_ERROR: 422,
};

export interface ApiErrorDetail {
  field: string;
  message: string;
}

/** ルートハンドラ内で throw する共通APIエラー。lib/api/handler.ts が捕捉してレスポンスに変換する。 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: ApiErrorDetail[];

  constructor(code: ErrorCode, message: string, details?: ApiErrorDetail[]) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = details;
  }
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ApiErrorDetail[];
  };
}

export function toErrorBody(error: ApiError): ApiErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };
}

export function apiErrorResponse(error: ApiError): NextResponse<ApiErrorBody> {
  return NextResponse.json(toErrorBody(error), { status: error.status });
}
