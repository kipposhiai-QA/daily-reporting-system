"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { apiClient, getStoredSalesPersonId, setStoredSalesPersonId } from "@/lib/api-client";
import type { SalesPersonResponse } from "@/lib/api/schemas/sales-person";

interface CurrentUserContextValue {
  /** 営業マスタ一覧（ユーザー切替ドロップダウンの選択肢）。 */
  salesPersons: SalesPersonResponse[];
  /** 現在選択中の営業担当者。読み込み中・未選択時はnull。 */
  currentUser: SalesPersonResponse | null;
  /** currentUser.is_manager のショートカット（未選択時はfalse）。 */
  isManager: boolean;
  isLoading: boolean;
  error: string | null;
  selectSalesPersonId: (id: number) => void;
}

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

/**
 * アプリ全体で「現在のユーザー」を保持するプロバイダ。
 * 初回マウント時に GET /api/sales-persons（ヘッダー不要）で一覧を取得し、
 * localStorageに保存済みのIDがあればそれを、無ければ一覧の先頭ユーザーを自動選択する
 * （画面定義書0.1のユーザー切替は初期状態の挙動を規定していないため、この方針で決め打ちする）。
 */
export function CurrentUserProvider({ children }: { children: React.ReactNode }) {
  const [salesPersons, setSalesPersons] = useState<SalesPersonResponse[]>([]);
  const [currentSalesPersonId, setCurrentSalesPersonId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const list = await apiClient.get<SalesPersonResponse[]>("/sales-persons");
        if (cancelled) return;

        setSalesPersons(list);

        const storedId = getStoredSalesPersonId();
        const initialId =
          list.find((person) => person.sales_person_id === storedId)?.sales_person_id ??
          (list.length > 0 ? list[0].sales_person_id : null);

        setCurrentSalesPersonId(initialId);
        setStoredSalesPersonId(initialId);
      } catch {
        if (!cancelled) {
          setError("営業担当者一覧の取得に失敗しました");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectSalesPersonId = useCallback((id: number) => {
    setCurrentSalesPersonId(id);
    setStoredSalesPersonId(id);
  }, []);

  const currentUser = useMemo(
    () => salesPersons.find((person) => person.sales_person_id === currentSalesPersonId) ?? null,
    [salesPersons, currentSalesPersonId],
  );

  const value = useMemo<CurrentUserContextValue>(
    () => ({
      salesPersons,
      currentUser,
      isManager: currentUser?.is_manager ?? false,
      isLoading,
      error,
      selectSalesPersonId,
    }),
    [salesPersons, currentUser, isLoading, error, selectSalesPersonId],
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
