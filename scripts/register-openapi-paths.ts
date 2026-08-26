// app/api 配下の route.ts を横断的にimportし、各ファイルの registry.registerPath 副作用を実行する。
// OpenAPIドキュメント生成専用のエントリポイント（scripts/generate-openapi.ts から呼び出す）。
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const API_DIR = join(__dirname, "..", "app", "api");

function collectRouteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    return statSync(fullPath).isDirectory()
      ? collectRouteFiles(fullPath)
      : entry === "route.ts"
        ? [fullPath]
        : [];
  });
}

export async function registerAllOpenApiPaths(): Promise<void> {
  for (const file of collectRouteFiles(API_DIR)) {
    await import(file);
  }
}
