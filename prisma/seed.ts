// テスト/開発用の共通シードデータ投入スクリプト。
// 参照: docs/test-specification.md 2.1 環境 / 2.2 共通シードデータ
//
// 実行前に対象テーブルをTRUNCATEしてから投入するため、テストケース間の依存を避けられる
// （毎回同じ初期状態からスタートできる）。DATABASE_URL が指す先を必ずローカル開発用
// またはCI/テスト用DBに限定すること（本番DBに向けて実行しないこと）。
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resetAndSeed } from "./seed-data";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

resetAndSeed(prisma)
  .then(async () => {
    console.log("Seed data inserted.");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
