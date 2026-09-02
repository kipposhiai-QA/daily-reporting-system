"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ApiClientError, apiClient, setStoredSalesPersonId } from "@/lib/api-client";
import type { SalesPersonResponse } from "@/lib/api/schemas/sales-person";

interface CurrentUserContextValue {
  /** 営業マスタ一覧（ユーザー切替ドロップダウンの選択肢・上長向けフィルタ等の表示用）。 */
  salesPersons: SalesPersonResponse[];
  /** ログイン中のSupabase Authセッションから解決した営業担当者。未解決時はnull。 */
  currentUser: SalesPersonResponse | null;
  /** currentUser.is_manager のショートカット（未解決時はfalse）。 */
  isManager: boolean;
  isLoading: boolean;
  error: string | null;
  /**
   * @deprecated ログイン中ユーザーの識別はSupabase Authセッションから自動的に解決するため、
   * 手動切替は実際のAPI呼び出しに影響しない（何もしない）。ヘッダーの担当者切替ドロップダウン
   * 自体の削除は別Issueで対応する（Issue #62時点では見た目上のみ残る）。
   */
  selectSalesPersonId: (id: number) => void;
  /**
   * salesPersons・currentUserを再取得する。ログイン成功直後など、Supabase Authセッションの
   * 状態が変化した後に呼び出す（初回マウント時のuseEffectでは変化を検知できないため）。
   * 参照: Issue #66
   */
  refresh: () => Promise<void>;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

/**
 * アプリ全体で「現在のユーザー」を保持するプロバイダ。
 * 初回マウント時に GET /api/sales-persons（一覧・ヘッダー不要）と GET /api/auth/me
 * （ログイン中のSupabase Authセッションから解決した営業担当者）を取得する。
 * 各画面のAPI呼び出し（lib/api-client.ts）に付与する X-Sales-Person-Id は、
 * ここで解決した currentUser.sales_person_id を自動的に使う。
 */
export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [salesPersons, setSalesPersons] = useState<SalesPersonResponse[]>([]);
  const [currentUser, setCurrentUser] = useState<SalesPersonResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [salesPersonsResult, currentUserResult] = await Promise.allSettled([
        apiClient.get<SalesPersonResponse[]>("/sales-persons"),
        apiClient.get<SalesPersonResponse>("/auth/me"),
      ]);
      if (cancelled) return;

      if (salesPersonsResult.status === "fulfilled") {
        setSalesPersons(salesPersonsResult.value);
      } else {
        setError("営業担当者一覧の取得に失敗しました");
      }

      if (currentUserResult.status === "fulfilled") {
        setCurrentUser(currentUserResult.value);
        setStoredSalesPersonId(currentUserResult.value.sales_person_id);
      } else {
        setCurrentUser(null);
        setStoredSalesPersonId(null);
        const message =
          currentUserResult.reason instanceof ApiClientError &&
          currentUserResult.reason.code === "UNAUTHENTICATED"
            ? "ログインしていません"
            : "ログイン中のユーザー情報の取得に失敗しました";
        setError((previous) => previous ?? message);
      }

      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ログイン成功直後など、初回マウント後にSupabase Authセッションが変化した場合に
  // 呼び出すための再取得関数（参照: Issue #66）。上記のマウント時useEffectとは独立して
  // 呼び出し側（components/auth/login-form.tsx）から明示的に呼ばれる。
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    const [salesPersonsResult, currentUserResult] = await Promise.allSettled([
      apiClient.get<SalesPersonResponse[]>("/sales-persons"),
      apiClient.get<SalesPersonResponse>("/auth/me"),
    ]);

    if (salesPersonsResult.status === "fulfilled") {
      setSalesPersons(salesPersonsResult.value);
    } else {
      setError("営業担当者一覧の取得に失敗しました");
    }

    if (currentUserResult.status === "fulfilled") {
      setCurrentUser(currentUserResult.value);
      setStoredSalesPersonId(currentUserResult.value.sales_person_id);
    } else {
      setCurrentUser(null);
      setStoredSalesPersonId(null);
      const message =
        currentUserResult.reason instanceof ApiClientError &&
        currentUserResult.reason.code === "UNAUTHENTICATED"
          ? "ログインしていません"
          : "ログイン中のユーザー情報の取得に失敗しました";
      setError((previous) => previous ?? message);
    }

    setIsLoading(false);
  }, []);

  const selectSalesPersonId = useCallback(() => {
    // ログイン中ユーザーの識別はSupabase Authセッションから自動的に解決するため、
    // ここでの手動切替は実際のAPI呼び出しに影響しない（意図的なno-op）。
  }, []);

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      salesPersons,
      currentUser,
      isManager: currentUser?.is_manager ?? false,
      isLoading,
      error,
      selectSalesPersonId,
      refresh,
    }),
    [salesPersons, currentUser, isLoading, error, selectSalesPersonId, refresh],
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser(): CurrentUserContextValue {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  }
  return context;
}
