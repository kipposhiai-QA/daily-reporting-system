// OpenAPIドキュメント（openapi.json）を生成するスクリプト。
// 各エンドポイント実装（#5〜#8）で lib/api/openapi.ts の registry に registerPath が
// 追加されるにつれ、生成される document に paths が増えていく想定。
// 実行: npm run openapi:generate
import { writeFileSync } from "node:fs";
import { OpenApiGeneratorV3 } from "@asteasolutions/zod-to-openapi";
import { registry } from "../lib/api/openapi";
import { registerAllOpenApiPaths } from "./register-openapi-paths";

async function main() {
  await registerAllOpenApiPaths();

  const generator = new OpenApiGeneratorV3(registry.definitions);

  const document = generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "営業日報システム API",
      version: "1.0.0",
      description: "docs/api-specification.md に基づくAPI仕様",
    },
    servers: [{ url: "/api" }],
  });

  writeFileSync("openapi.json", `${JSON.stringify(document, null, 2)}\n`);
  console.log("openapi.json を生成しました。");
}

main();
