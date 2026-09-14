This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## データベース (Prisma / Supabase)

このプロジェクトは [Prisma ORM](https://www.prisma.io/) (v7) を使用し、Supabase (PostgreSQL) に接続する。

1. `.env.example` を `.env` にコピーし、Supabaseの接続情報を設定する。
   - `DATABASE_URL`: プーリング接続（pgbouncer, port 6543）。アプリの通常クエリで使用。
   - `DIRECT_URL`: 直接接続（port 5432）。マイグレーション実行時に `--url` オプション経由で使用。
2. Prisma Client を生成する（`npm install` 時に `postinstall` で自動実行される）。
   ```bash
   npm run db:generate
   ```
3. マイグレーションを実行し、スキーマをDBへ反映する。
   ```bash
   npm run db:migrate
   ```
4. `prisma/schema.prisma` を変更した場合は、`npm run db:migrate` で新しいマイグレーションを作成する。
5. 開発・テスト用の共通シードデータを投入する（`docs/test-specification.md` 2.2 参照）。
   ```bash
   npm run db:seed
   ```
   `prisma/seed.ts` は実行のたびに対象テーブルをTRUNCATEしてから再投入するため、常に同じ初期状態から
   やり直せる。**ローカル開発用・CI/テスト用のDB以外（本番相当のDB）に対しては実行しないこと。**

その他のコマンド:

```bash
npm run db:migrate:deploy  # 本番/CI向け: 既存マイグレーションの適用のみ（新規作成しない）
npm run db:push            # マイグレーション履歴を作らずスキーマを直接反映（プロトタイピング用）
npm run db:studio          # Prisma Studio (DBのGUIビューア) を起動
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
