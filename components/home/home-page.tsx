"use client";

import Link from "next/link";
import { FileTextIcon, type LucideIcon, RocketIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentUser } from "@/lib/current-user-context";

interface FeatureLink {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
  cta: string;
}

const LOGIN_HREF = "/login";

const FEATURE_LINKS: FeatureLink[] = [
  {
    href: LOGIN_HREF,
    title: "クイックスタート",
    description: "システムを利用開始するには、まずログインしてください。",
    icon: RocketIcon,
    cta: "ログインページへ",
  },
  {
    href: "/reports",
    title: "日報管理",
    description: "日報の作成、閲覧、管理を効率的に行えます。",
    icon: FileTextIcon,
    cta: "日報一覧へ",
  },
  {
    href: "/customers",
    title: "顧客管理",
    description: "訪問先の顧客情報を一元管理できます。",
    icon: UsersIcon,
    cta: "顧客管理へ",
  },
  {
    href: "/sales-persons",
    title: "システム設定",
    description: "営業担当者やシステムの設定を管理できます。",
    icon: SettingsIcon,
    cta: "設定へ",
  },
];

export function HomePage() {
  const { isLoading, currentUser } = useCurrentUser();

  // ログイン済みの場合、proxy.ts が /login へのアクセスを / へ即座にリダイレクトして
  // しまうため、「クイックスタート」カードを表示したままだと押しても無反応に見える
  // (参照: 本番環境での報告)。ログイン確認が取れるまで(isLoading中)は現状維持のまま
  // 表示し、ログイン済みと判明した時点でカードを取り除く。
  const featureLinks =
    !isLoading && currentUser
      ? FEATURE_LINKS.filter((feature) => feature.href !== LOGIN_HREF)
      : FEATURE_LINKS;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center gap-10 p-4 py-12 sm:p-8">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-3xl font-bold">営業日報システム</h1>
        <p className="text-muted-foreground">
          営業担当者が日々の活動を報告し、上長がフィードバックを行うためのシステムです
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
        {featureLinks.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.href}>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon aria-hidden="true" className="text-muted-foreground size-5" />
                  <CardTitle>{feature.title}</CardTitle>
                </div>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  href={feature.href}
                  className="text-primary text-sm font-medium hover:underline"
                >
                  {feature.cta}
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        © {new Date().getFullYear()} 営業日報システム. All rights reserved.
      </p>
    </div>
  );
}
