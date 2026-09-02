import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getStoredSalesPersonId } from "./api-client";
import { CurrentUserProvider, useCurrentUser } from "./current-user-context";

const YAMADA = {
  sales_person_id: 1,
  name: "山田太郎",
  email: "yamada@example.com",
  department: "営業1課",
  is_manager: false,
  created_at: "2026-08-01T09:00:00+09:00",
  updated_at: "2026-08-01T09:00:00+09:00",
};

const SUZUKI_MANAGER = { ...YAMADA, sales_person_id: 5, name: "鈴木一郎", is_manager: true };

function mockFetch({
  salesPersons = [],
  me,
  meStatus = 200,
}: {
  salesPersons?: unknown[];
  me?: unknown;
  meStatus?: number;
}) {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/api/auth/me")) {
        return Promise.resolve({
          status: meStatus,
          ok: meStatus < 400,
          json: () =>
            Promise.resolve(
              meStatus < 400
                ? me
                : { error: { code: "UNAUTHENTICATED", message: "ログインしていません" } },
            ),
        });
      }
      if (url.includes("/api/sales-persons")) {
        return Promise.resolve({
          status: 200,
          ok: true,
          json: () => Promise.resolve(salesPersons),
        });
      }
      return Promise.reject(new Error(`unexpected fetch call: ${url}`));
    }),
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CurrentUserProvider / useCurrentUser", () => {
  it("throws when used outside a CurrentUserProvider", () => {
    const { result } = renderHook(() => {
      try {
        return useCurrentUser();
      } catch (error) {
        return error;
      }
    });
    expect(result.current).toBeInstanceOf(Error);
  });

  it("resolves the current user from the login session (GET /api/auth/me)", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: YAMADA });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentUser?.sales_person_id).toBe(1);
    expect(result.current.isManager).toBe(false);
    expect(result.current.salesPersons).toEqual([YAMADA, SUZUKI_MANAGER]);
    expect(getStoredSalesPersonId()).toBe(1);
    expect(result.current.error).toBeNull();
  });

  it("reflects is_manager from the session-resolved user", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: SUZUKI_MANAGER });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentUser?.sales_person_id).toBe(5);
    expect(result.current.isManager).toBe(true);
  });

  it("ignores selectSalesPersonId (manual switching no longer affects the resolved user)", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: YAMADA });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.selectSalesPersonId(5);

    expect(result.current.currentUser?.sales_person_id).toBe(1);
    expect(getStoredSalesPersonId()).toBe(1);
  });

  it("sets an error message when the sales-persons list fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((input: RequestInfo | URL) => {
        const url = typeof input === "string" ? input : input.toString();
        if (url.includes("/api/auth/me")) {
          return Promise.resolve({
            status: 200,
            ok: true,
            json: () => Promise.resolve(YAMADA),
          });
        }
        return Promise.reject(new Error("network error"));
      }),
    );

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("営業担当者一覧の取得に失敗しました");
    expect(result.current.currentUser?.sales_person_id).toBe(1);
  });

  it("sets an error and clears the current user when the session cannot be resolved (401)", async () => {
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], meStatus: 401 });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("ログインしていません");
    expect(result.current.currentUser).toBeNull();
    expect(getStoredSalesPersonId()).toBeNull();
  });

  it("re-resolves the current user via refresh() after the session changes (Issue #66)", async () => {
    // ログイン前（未ログイン=401）の状態でマウントする
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], meStatus: 401 });

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.currentUser).toBeNull();

    // ログイン成功によりセッションのcookieが更新された状態を模す
    mockFetch({ salesPersons: [YAMADA, SUZUKI_MANAGER], me: YAMADA });

    await result.current.refresh();

    await waitFor(() => expect(result.current.currentUser?.sales_person_id).toBe(1));
    expect(result.current.error).toBeNull();
    expect(getStoredSalesPersonId()).toBe(1);
  });
});
