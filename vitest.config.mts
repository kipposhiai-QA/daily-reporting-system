import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // e2e/**/*.spec.ts は Playwright専用（playwright.config.ts、`npm run test:e2e`）。
    // vitestのデフォルトincludeパターンは *.spec.ts にもマッチするため、誤って拾って
    // 実行しないよう明示的に除外する（Playwrightの test()/test.describe() は vitest の
    // ランナー上では動作しない）。
    exclude: ["node_modules", ".next", "e2e/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./vitest.setup.ts"],
          exclude: ["node_modules", ".next", "e2e/**", "**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          // API結合テスト（tests/integration/db.ts）は同一のテスト用DBに対して
          // TRUNCATE→再投入を行うため、ファイル間で並列実行すると競合する。
          // このプロジェクトのみシーケンシャル実行にする。
          name: "integration",
          environment: "node",
          setupFiles: ["./tests/integration/setup.ts"],
          include: ["**/*.integration.test.ts"],
          exclude: ["node_modules", ".next", "e2e/**"],
          fileParallelism: false,
        },
      },
    ],
  },
});
