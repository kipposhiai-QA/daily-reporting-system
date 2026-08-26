// フロントエンドから /api を呼び出す共通クライアント。
// 参照: docs/api-specification.md 1.2（X-Sales-Person-Id ヘッダー）
// 現在選択中の営業担当者IDをlocalStorageから読み取り、全リクエストに自動付与する。

const CURRENT_SALES_PERSON_ID_KEY = "daily-reporting-system:current-sales-person-id";

/** localStorageに保持している現在の営業担当者IDを取得する（SSR時・未選択時はnull）。 */
export function getStoredSalesPersonId(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CURRENT_SALES_PERSON_ID_KEY);
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

/** 現在の営業担当者IDをlocalStorageに保存する。nullで選択解除。 */
export function setStoredSalesPersonId(id: number | null): void {
  if (typeof window === "undefined") return;
  if (id === null) {
    window.localStorage.removeItem(CURRENT_SALES_PERSON_ID_KEY);
  } else {
    window.localStorage.setItem(CURRENT_SALES_PERSON_ID_KEY, String(id));
  }
}

export interface ApiErrorDetail {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}

/** docs/api-specification.md 1.4 の共通エラー形式をラップする例外。 */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorDetail[];

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = body.error.code;
    this.details = body.error.details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const salesPersonId = getStoredSalesPersonId();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (salesPersonId !== null) {
    headers.set("X-Sales-Person-Id", String(salesPersonId));
  }

  const response = await fetch(`/api${path}`, { ...init, headers });

  if (response.status === 204) {
    return undefined as T;
  }

  const body: unknown = await response.json();

  if (!response.ok) {
    throw new ApiClientError(response.status, body as ApiErrorBody);
  }

  return body as T;
}

/** 全画面の実装（#11〜）はAPI呼び出しにこのクライアントを使う。 */
export const apiClient = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: data !== undefined ? JSON.stringify(data) : undefined,
    }),
  delete: <T = void>(path: string) => request<T>(path, { method: "DELETE" }),
};
