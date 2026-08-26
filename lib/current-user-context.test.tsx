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

function mockSalesPersonsFetch(list: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ status: 200, ok: true, json: () => Promise.resolve(list) }),
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

  it("auto-selects the first sales person when nothing is stored", async () => {
    mockSalesPersonsFetch([YAMADA, SUZUKI_MANAGER]);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentUser?.sales_person_id).toBe(1);
    expect(result.current.isManager).toBe(false);
    expect(getStoredSalesPersonId()).toBe(1);
  });

  it("restores a previously stored id when it still exists in the list", async () => {
    window.localStorage.setItem("daily-reporting-system:current-sales-person-id", "5");
    mockSalesPersonsFetch([YAMADA, SUZUKI_MANAGER]);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentUser?.sales_person_id).toBe(5);
    expect(result.current.isManager).toBe(true);
  });

  it("falls back to the first sales person when the stored id no longer exists", async () => {
    window.localStorage.setItem("daily-reporting-system:current-sales-person-id", "999");
    mockSalesPersonsFetch([YAMADA, SUZUKI_MANAGER]);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.currentUser?.sales_person_id).toBe(1);
    expect(getStoredSalesPersonId()).toBe(1);
  });

  it("updates the selection and persists it when selectSalesPersonId is called", async () => {
    mockSalesPersonsFetch([YAMADA, SUZUKI_MANAGER]);

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    result.current.selectSalesPersonId(5);

    await waitFor(() => expect(result.current.currentUser?.sales_person_id).toBe(5));
    expect(result.current.isManager).toBe(true);
    expect(getStoredSalesPersonId()).toBe(5);
  });

  it("sets an error message when the sales-persons fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: CurrentUserProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.error).toBe("営業担当者一覧の取得に失敗しました");
    expect(result.current.currentUser).toBeNull();
  });
});
