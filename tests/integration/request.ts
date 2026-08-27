// APIエンドポイントの結合テスト共通のNextRequestビルダー。
import { NextRequest } from "next/server";

export function authHeaders(salesPersonId?: number): Record<string, string> {
  return salesPersonId === undefined ? {} : { "X-Sales-Person-Id": String(salesPersonId) };
}

export function getRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { headers: { "content-type": "application/json", ...headers } });
}

export function postRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

export function putRequest(
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest(url, {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", ...headers },
  });
}

export function deleteRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, {
    method: "DELETE",
    headers: { "content-type": "application/json", ...headers },
  });
}

export function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}
