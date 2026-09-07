// PlaywrightのE2Eテスト実行前に一度だけ実行されるセットアップ。
// 実体（DBシード・Supabase Authテストユーザーの作成/紐付け）は e2e/seed.ts にあり、
// `npx tsx e2e/seed.ts` としてサブプロセスで実行する。generated/prisma/client.ts が
// import.meta.url を使うESM専用のコードで、PlaywrightのTypeScriptローダー（既定で
// CommonJSとして変換する）経由でPrisma Clientを直接importすると
// `SyntaxError: Cannot use 'import.meta' outside a module` になるため、
// tsx（prisma/seed.ts と同じ実行方式。参照: prisma.config.ts）に委譲する。
import { spawnSync } from "node:child_process";

export default function globalSetup(): void {
  const result = spawnSync("npx", ["tsx", "e2e/seed.ts"], {
    stdio: "inherit",
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error("e2e/seed.ts の実行に失敗しました（詳細は上記の出力を参照）。");
  }
}
