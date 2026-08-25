// Prisma ORM v7 の設定ファイル。接続情報は schema.prisma ではなくここで管理する。
// 学習元: https://pris.ly/prisma-config-env-vars
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Supabase: プーリング接続（pgbouncer, port 6543）。アプリの通常クエリで使用。
    // Prisma ORM v7 の datasource 設定に directUrl は存在しないため、
    // マイグレーション実行時は `prisma migrate dev --url "$DIRECT_URL"` のように
    // CLIの --url オプションで直接接続（DIRECT_URL, port 5432）に切り替える
    // （package.json の db:migrate* スクリプトを参照）。
    url: env("DATABASE_URL"),
  },
});
