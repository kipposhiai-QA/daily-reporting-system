import { describe, expect, it } from "vitest";
import { ApiError, apiErrorResponse, toErrorBody } from "./errors";

describe("ApiError", () => {
  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["CONFLICT", 409],
    ["VALIDATION_ERROR", 422],
  ] as const)("maps %s to status %d", (code, status) => {
    const error = new ApiError(code, "message");
    expect(error.status).toBe(status);
  });
});

describe("toErrorBody", () => {
  it("omits details when not provided", () => {
    const error = new ApiError("NOT_FOUND", "見つかりません");
    expect(toErrorBody(error)).toEqual({
      error: { code: "NOT_FOUND", message: "見つかりません" },
    });
  });

  it("includes details when provided", () => {
    const error = new ApiError("VALIDATION_ERROR", "入力内容に誤りがあります", [
      { field: "email", message: "メールアドレスは必須です" },
    ]);
    expect(toErrorBody(error)).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "入力内容に誤りがあります",
        details: [{ field: "email", message: "メールアドレスは必須です" }],
      },
    });
  });
});

describe("apiErrorResponse", () => {
  it("builds a NextResponse with the matching status and JSON body", async () => {
    const error = new ApiError("CONFLICT", "既に存在します");
    const response = apiErrorResponse(error);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: { code: "CONFLICT", message: "既に存在します" },
    });
  });
});
