"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/lib/current-user-context";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/reports", label: "日報" },
  { href: "/customers", label: "顧客マスタ" },
  { href: "/sales-persons", label: "営業マスタ" },
] as const;

// ヘッダーを表示しない、未ログインでもアクセスできるページ。
const HEADERLESS_PATHS = ["/login", "/reset-password", "/reset-password/confirm"];

function roleLabel(isManager: boolean): string {
  return isManager ? "上長" : "営業";
}

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isLoading, error } = useCurrentUser();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (HEADERLESS_PATHS.includes(pathname)) {
    return null;
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="border-border border-b">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <Link href="/" className="text-lg font-semibold hover:underline">
            営業日報システム
          </Link>
          <nav className="flex flex-wrap gap-1" aria-label="グローバルナビ">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <span className="text-muted-foreground">
              {isLoading
                ? "読み込み中..."
                : currentUser
                  ? `${currentUser.name}（${roleLabel(currentUser.is_manager)}）`
                  : null}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={handleLogout} disabled={isLoggingOut}>
            {isLoggingOut ? "ログアウト中..." : "ログアウト"}
          </Button>
        </div>
      </div>
    </header>
  );
}
