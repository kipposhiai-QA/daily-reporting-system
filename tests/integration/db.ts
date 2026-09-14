// APIエンドポイントの結合テスト共通のDB初期化ヘルパー。
// 参照: docs/test-specification.md 2.1 環境 / 2.2 共通シードデータ
//
// アプリ本体が読む DATABASE_URL/DIRECT_URL には、開発環境によって本番相当のSupabase
// プロジェクトが設定されている場合がある。誤ってそこに対してTRUNCATEを実行しないよう、
// この結合テストは専用の TEST_DATABASE_URL が設定されている場合にのみ実行する
// （vitest.setup.ts が、存在する場合に限り DATABASE_URL をこの値で上書きする）。
// 未設定の環境（このリポジトリの開発コンテナや、テストDBを持たないローカル環境）では
// `describe.skipIf(!hasTestDatabase())` でスキップし、CIでは専用のテストDBを用意した上で
// 実行する（セットアップ手順は docs/test-specification.md 2.1 参照）。
import { prisma } from "@/lib/prisma";
import { resetAndSeed } from "@/prisma/seed-data";

export function hasTestDatabase(): boolean {
  return Boolean(process.env.TEST_DATABASE_URL);
}

/** 各テストケース実行前にDBを共通シードデータへ初期化する（docs/test-specification.md 2.2）。 */
export async function resetTestDatabase(): Promise<void> {
  await resetAndSeed(prisma);
}
