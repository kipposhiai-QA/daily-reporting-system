// zod-to-openapi の `.openapi()` 拡張を有効化する副作用専用モジュール。
// extendZodWithOpenApi は呼び出し時点より後に生成されたスキーマにしか `.openapi()` を
// 生やさないため、zodスキーマを定義する全モジュール（lib/api/datetime.ts 等、
// 自身のスキーマをモジュール読み込み時に生成するもの）は、そのスキーマ定義より前に
// 本モジュールを副作用目的でimportし、拡張適用済みであることを保証すること。
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);
