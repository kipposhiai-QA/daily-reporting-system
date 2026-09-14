// 共通シードデータ投入ロジック。
// 参照: docs/test-specification.md 2.2 共通シードデータ
//
// `prisma/seed.ts`（開発用シード投入CLI）と `tests/integration/db.ts`（APIテスト用のDB初期化）
// の両方から呼び出す共有実装。シード内容の重複・drift を避けるためにここへ集約する。
import type { PrismaClient } from "../generated/prisma/client";

/** 実行前に対象テーブルをTRUNCATEしてから共通シードデータを投入する。 */
export async function resetAndSeed(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "manager_comment", "visit_record", "daily_report", "customer", "sales_person" RESTART IDENTITY CASCADE;`,
  );

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

  await syncSequence(prisma, "sales_person", "sales_person_id");
  await syncSequence(prisma, "customer", "customer_id");
  await syncSequence(prisma, "daily_report", "report_id");
}

// 明示的なIDで挿入した行のぶん、次のautoincrement採番が衝突しないよう
// シーケンスをテーブルの現在の最大IDに合わせておく。
async function syncSequence(prisma: PrismaClient, table: string, idColumn: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('${table}', '${idColumn}'), (SELECT COALESCE(MAX(${idColumn}), 1) FROM "${table}"));`,
  );
}
