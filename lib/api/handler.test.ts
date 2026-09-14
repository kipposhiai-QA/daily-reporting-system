import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "./errors";
import { withApiHandler } from "./handler";

describe("withApiHandler", () => {
  it("passes through a successful response unchanged", async () => {
    const handler = withApiHandler(async () => NextResponse.json({ ok: true }));

    const response = await handler();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it("converts a thrown ApiError into the common error body", async () => {
    const handler = withApiHandler(async () => {
      throw new ApiError("NOT_FOUND", "見つかりません");
    });

    const response = await handler();
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "NOT_FOUND", message: "見つかりません" },
    });
  });

  it("converts a thrown ZodError into a 422 VALIDATION_ERROR", async () => {
    const schema = z.object({ name: z.string() });
    const handler = withApiHandler(async () => {
      schema.parse({});
      return NextResponse.json({});
    });

    const response = await handler();
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toEqual([{ field: "name", message: expect.any(String) }]);
  });

  it("converts an unexpected error into a 500 response", async () => {
    const handler = withApiHandler(async () => {
      throw new Error("boom");
    });

    const response = await handler();
    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
