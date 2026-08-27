import "dotenv/config";

// API結合テスト（tests/integration/db.ts 経由）が使う専用のテストDB接続情報。
// 設定されている場合のみ、アプリ本体（lib/prisma.ts）が読む DATABASE_URL/DIRECT_URL を
// 上書きする。未設定なら .env の値（本番相当のSupabaseプロジェクトの場合がある）はそのまま
// 触らず、結合テスト側は tests/integration/db.ts の hasTestDatabase() でスキップする。
// 参照: docs/test-specification.md 2.1 環境
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
if (process.env.TEST_DIRECT_URL) {
  process.env.DIRECT_URL = process.env.TEST_DIRECT_URL;
}
