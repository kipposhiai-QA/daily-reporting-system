"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/lib/current-user-context";

const NAV_ITEMS = [
  { href: "/reports", label: "日報" },
  { href: "/customers", label: "顧客マスタ" },
  { href: "/sales-persons", label: "営業マスタ" },
] as const;

function roleLabel(isManager: boolean): string {
  return isManager ? "上長" : "営業";
}

export function SiteHeader() {
  const pathname = usePathname();
  const { salesPersons, currentUser, isLoading, error, selectSalesPersonId } = useCurrentUser();

  return (
    <header className="border-border border-b">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
          <span className="text-lg font-semibold">営業日報システム</span>
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

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">現在のユーザー:</span>
          {error ? (
            <span className="text-destructive">{error}</span>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isLoading || salesPersons.length === 0}
                >
                  {isLoading
                    ? "読み込み中..."
                    : currentUser
                      ? `${currentUser.name}（${roleLabel(currentUser.is_manager)}）`
                      : "未選択"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>営業担当者を選択</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {salesPersons.map((person) => (
                  <DropdownMenuItem
                    key={person.sales_person_id}
                    onSelect={() => selectSalesPersonId(person.sales_person_id)}
                  >
                    {person.name}（{roleLabel(person.is_manager)}）
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
