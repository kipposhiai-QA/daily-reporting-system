import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";

// E2EテストはローカルのSupabase CLIスタック（`supabase start`）専用（参照: e2e/global-setup.ts、
// docs/test-specification.md）。CI（.github/workflows/ci.yml の e2e ジョブ）では、事前に
// `npm run build` 済みの本番相当ビルドを起動する。next.config.ts の `output: "standalone"`
// により `next start`（`npm run start`）は使えない（Dockerfile と同様、`.next/standalone/server.js`
// を直接起動する。静的アセットのコピーはCIワークフロー側で行う）。ローカル実行時は
// `npm run dev` を自動起動する（開発の手軽さを優先し、事前ビルドを不要にする）。
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  // CIでは "github" 単体だと playwright-report/ が生成されず、ci.yml の
  // 「Upload Playwright report」ステップが常に空のアーティファクトになっていた
  // （path not foundを既定の "warn" で握りつぶすため、CI自体は失敗しない）。
  // "html" を併用してレポート本体を生成する（open: "never" でCI中の自動オープンを抑止）。
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  // CIでは起動直後のSupabaseローカルスタック・standaloneサーバーへの初回リクエストが
  // 既定の5秒を超えることがあるため、expectのタイムアウトを伸ばす。
  expect: { timeout: 10_000 },
  // e2e/global-setup.ts はDBシード等の実体を `npx tsx e2e/seed.ts` に委譲する
  // （generated/prisma/client.tsがESM専用のコードで、Playwright自身のTypeScriptローダー
  // 経由での読み込みに失敗するため。詳細は e2e/global-setup.ts のコメント参照）。
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: process.env.CI ? "node .next/standalone/server.js" : "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: "3000" },
  },
});
