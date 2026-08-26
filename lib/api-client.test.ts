import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiClientError,
  apiClient,
  getStoredSalesPersonId,
  setStoredSalesPersonId,
} from "./api-client";

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getStoredSalesPersonId / setStoredSalesPersonId", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredSalesPersonId()).toBeNull();
  });

  it("round-trips an id through localStorage", () => {
    setStoredSalesPersonId(5);
    expect(getStoredSalesPersonId()).toBe(5);
  });

  it("clears the stored id when set to null", () => {
    setStoredSalesPersonId(5);
    setStoredSalesPersonId(null);
    expect(getStoredSalesPersonId()).toBeNull();
    expect(
      window.localStorage.getItem("daily-reporting-system:current-sales-person-id"),
    ).toBeNull();
  });

  it("returns null for a corrupted (non-numeric) stored value", () => {
    window.localStorage.setItem("daily-reporting-system:current-sales-person-id", "not-a-number");
    expect(getStoredSalesPersonId()).toBeNull();
  });
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
  it("attaches X-Sales-Person-Id when an id is stored", async () => {
    setStoredSalesPersonId(1);
    const fetchMock = mockFetchOnce({ status: 200, body: [] });

    await apiClient.get("/reports");

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("X-Sales-Person-Id")).toBe("1");
  });

  it("omits X-Sales-Person-Id when no id is stored", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: [] });

    await apiClient.get("/sales-persons");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/sales-persons");
    const headers = init.headers as Headers;
    expect(headers.has("X-Sales-Person-Id")).toBe(false);
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
