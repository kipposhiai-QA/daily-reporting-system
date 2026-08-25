// テスト/開発用の共通シードデータ投入スクリプト。
// 参照: docs/test-specification.md 2.1 環境 / 2.2 共通シードデータ
//
// 実行前に対象テーブルをTRUNCATEしてから投入するため、テストケース間の依存を避けられる
// （毎回同じ初期状態からスタートできる）。DATABASE_URL が指す先を必ずローカル開発用
// またはCI/テスト用DBに限定すること（本番DBに向けて実行しないこと）。
import "dotenv/config";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "manager_comment", "visit_record", "daily_report", "customer", "sales_person" RESTART IDENTITY CASCADE;`,
  );
}

// 明示的なIDで挿入した行のぶん、次のautoincrement採番が衝突しないよう
// シーケンスをテーブルの現在の最大IDに合わせておく。
async function syncSequence(table: string, idColumn: string) {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('${table}', '${idColumn}'), (SELECT COALESCE(MAX(${idColumn}), 1) FROM "${table}"));`,
  );
}

async function main() {
  await resetDatabase();

  await prisma.salesPerson.createMany({
    data: [
      {
        sales_person_id: 1,
        name: "山田太郎",
        email: "yamada@example.com",
        department: "営業1課",
        is_manager: false,
      },
      {
        sales_person_id: 2,
        name: "田中花子",
        email: "tanaka@example.com",
        department: "営業2課",
        is_manager: false,
      },
      {
        sales_person_id: 5,
        name: "鈴木一郎",
        email: "suzuki@example.com",
        department: "営業1課",
        is_manager: true,
      },
    ],
  });

  await prisma.customer.createMany({
    data: [
      { customer_id: 1, company_name: "株式会社A社" },
      { customer_id: 2, company_name: "株式会社B社" },
    ],
  });

  // report_id=10: 山田太郎、2026-08-25、提出済み、訪問記録2件
  // （docs/api-specification.md 5.2 のレスポンス例と同じ内容）
  await prisma.dailyReport.create({
    data: {
      report_id: 10,
      sales_person_id: 1,
      report_date: new Date("2026-08-25"),
      status: "SUBMITTED",
      problem: "A社の見積もり承認が遅れている",
      plan: "C社へ初回訪問予定",
      visit_records: {
        create: [
          {
            customer_id: 1,
            visit_content: "新商品の提案を実施",
            visit_time: new Date("1970-01-01T10:00:00.000Z"),
          },
          {
            customer_id: 2,
            visit_content: "定期フォロー訪問",
            visit_time: new Date("1970-01-01T13:30:00.000Z"),
          },
        ],
      },
    },
  });

  // report_id=11: 山田太郎、2026-08-24、下書き、訪問記録なし
  await prisma.dailyReport.create({
    data: {
      report_id: 11,
      sales_person_id: 1,
      report_date: new Date("2026-08-24"),
      status: "DRAFT",
    },
  });

  await syncSequence("sales_person", "sales_person_id");
  await syncSequence("customer", "customer_id");
  await syncSequence("daily_report", "report_id");

  console.log("Seed data inserted.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
