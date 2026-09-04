// フロントエンドから /api を呼び出す共通クライアント。
// 全APIエンドポイントはSupabase Authのログインセッション（cookie）で本人を識別する
// （docs/api-specification.md 1.2、Issue #78）。fetchは同一オリジンへのリクエストに
// cookieを自動的に付与するため、このクライアント側で識別情報を明示的に付与する必要はない。

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
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");

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
