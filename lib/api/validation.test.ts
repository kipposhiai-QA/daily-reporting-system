import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "./errors";
import { parseJsonBody, parseSearchParams, parseWithSchema } from "./validation";

const bodySchema = z.object({
  name: z.string().min(1),
  age: z.number().optional(),
});

describe("parseWithSchema", () => {
  it("returns the parsed data on success", () => {
    expect(parseWithSchema(bodySchema, { name: "山田太郎" })).toEqual({ name: "山田太郎" });
  });

  it("throws a VALIDATION_ERROR ApiError with field details on failure", () => {
    try {
      parseWithSchema(bodySchema, { name: "" });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.code).toBe("VALIDATION_ERROR");
      expect(apiError.details).toEqual([{ field: "name", message: expect.any(String) }]);
    }
  });
});

describe("parseJsonBody", () => {
  it("parses a valid JSON body", async () => {
    const request = new NextRequest("http://localhost/api/x", {
      method: "POST",
      body: JSON.stringify({ name: "田中花子" }),
      headers: { "content-type": "application/json" },
    });

    await expect(parseJsonBody(request, bodySchema)).resolves.toEqual({ name: "田中花子" });
  });

  it("throws VALIDATION_ERROR when the body is not valid JSON", async () => {
    const request = new NextRequest("http://localhost/api/x", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });

    await expect(parseJsonBody(request, bodySchema)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
  });
});

describe("parseSearchParams", () => {
  it("parses query parameters through the schema", () => {
    const schema = z.object({ company_name: z.string().optional() });
    const params = new URLSearchParams({ company_name: "A社" });

    expect(parseSearchParams(params, schema)).toEqual({ company_name: "A社" });
  });
});
