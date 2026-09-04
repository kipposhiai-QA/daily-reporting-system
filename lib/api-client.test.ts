import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError, apiClient } from "./api-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

function mockFetchOnce(response: { status: number; body?: unknown }) {
  const fetchMock = vi.fn().mockResolvedValue({
    status: response.status,
    ok: response.status >= 200 && response.status < 300,
    json: () => Promise.resolve(response.body),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("apiClient", () => {
  it("requests the given path under /api with a JSON content type", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: [] });

    await apiClient.get("/sales-persons");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sales-persons");
    const headers = init.headers as Headers;
    expect(headers.get("Content-Type")).toBe("application/json");
  });

  it("returns undefined for a 204 response without parsing a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 204, ok: true, json: vi.fn() });
    vi.stubGlobal("fetch", fetchMock);

    const result = await apiClient.delete("/customers/1");

    expect(result).toBeUndefined();
  });

  it("throws ApiClientError with the parsed error body on a non-ok response", async () => {
    mockFetchOnce({
      status: 422,
      body: {
        error: {
          code: "VALIDATION_ERROR",
          message: "入力内容に誤りがあります",
          details: [{ field: "company_name", message: "会社名は必須です" }],
        },
      },
    });

    await expect(apiClient.post("/customers", {})).rejects.toMatchObject({
      status: 422,
      code: "VALIDATION_ERROR",
      message: "入力内容に誤りがあります",
    });
  });

  it("is an instance of ApiClientError", async () => {
    mockFetchOnce({
      status: 404,
      body: { error: { code: "NOT_FOUND", message: "見つかりません" } },
    });

    await expect(apiClient.get("/customers/999")).rejects.toBeInstanceOf(ApiClientError);
  });

  it("sends a JSON-stringified body for post/put", async () => {
    const fetchMock = mockFetchOnce({ status: 201, body: { customer_id: 1 } });

    await apiClient.post("/customers", { company_name: "株式会社A社" });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ company_name: "株式会社A社" }));
  });
});
