// e2e/global-setup.ts（PlaywrightのglobalSetup）から `tsx` サブプロセスとして起動される
// シードスクリプト。
// - ローカルのSupabase CLIスタック（`supabase start`）のDBに、共通シードデータ
//   （prisma/seed-data.ts、docs/test-specification.md 2.2）を投入する
// - シードした SalesPerson（山田太郎, sales_person_id=1）に、Supabase Authの
//   テストユーザーを auth_user_id で紐付ける
//
// generated/prisma/client.ts は import.meta.url を使うESM専用のコードで、Playwright自身の
// TypeScriptローダー（既定でCommonJSとして変換する）経由でPrisma Clientを読み込むと
// `SyntaxError: Cannot use 'import.meta' outside a module` になる（prisma/seed.ts が
// `tsx prisma/seed.ts` で実行されているのと同じ理由でtsxに委譲する。参照: prisma.config.ts）。
// そのため、このファイルはPlaywrightのプロセス内で直接importされず、
// `npx tsx e2e/seed.ts` として別プロセスで実行する。
//
// 安全のため、本番/共有DBを指す可能性のある値では絶対に実行しない
// （tests/integration/setup.ts と同じ考え方。参照: docs/test-specification.md）。
// E2Eテストはローカルの Supabase CLI スタック（127.0.0.1）専用とし、必須の環境変数
// （E2E_DATABASE_URL / E2E_SUPABASE_URL / E2E_SUPABASE_SERVICE_ROLE_KEY）が
// ローカルホスト以外を指している場合はエラーで停止する。
import { PrismaPg } from "@prisma/adapter-pg";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { PrismaClient } from "@/generated/prisma/client";
import { resetAndSeed } from "@/prisma/seed-data";
import { TEST_USER } from "./fixtures/test-users";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} が設定されていません。E2Eテストの実行方法は docs/test-specification.md を参照してください。`,
    );
  }
  return value;
}

/** ローカルのSupabase CLIスタック（127.0.0.1 / localhost）以外を誤って対象にしないためのガード。 */
function assertLocalUrl(name: string, value: string): void {
  let host: string;
  try {
    host = new URL(value.replace(/^postgres(ql)?:\/\//, "http://")).hostname;
  } catch {
    throw new Error(`${name} の形式が不正です: ${value}`);
  }
  if (host !== "127.0.0.1" && host !== "localhost") {
    throw new Error(
      `${name} がローカルホスト以外を指しています（host: ${host}）。E2Eテストはローカルの` +
        "Supabase CLIスタック（`supabase start`）専用です。共有/本番のSupabaseプロジェクトに" +
        "対して実行しないでください。",
    );
  }
}

async function main(): Promise<void> {
  const databaseUrl = requiredEnv("E2E_DATABASE_URL");
  const supabaseUrl = requiredEnv("E2E_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("E2E_SUPABASE_SERVICE_ROLE_KEY");

  assertLocalUrl("E2E_DATABASE_URL", databaseUrl);
  assertLocalUrl("E2E_SUPABASE_URL", supabaseUrl);

  const adapter = new PrismaPg({ connectionString: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    await resetAndSeed(prisma);

    const authUserId = await ensureTestAuthUser(supabaseAdmin);

    await prisma.salesPerson.update({
      where: { sales_person_id: TEST_USER.salesPersonId },
      data: { auth_user_id: authUserId },
    });
  } finally {
    await prisma.$disconnect();
  }
}

/** テスト用ユーザーをSupabase Authに作成する（既に存在する場合は既存ユーザーを再利用する）。 */
async function ensureTestAuthUser(supabaseAdmin: SupabaseClient): Promise<string> {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: TEST_USER.email,
    password: TEST_USER.password,
    email_confirm: true,
  });

  if (!createError) {
    return created.user.id;
  }

  // 既に存在する場合（`supabase db reset` 等を挟まず前回の `supabase start` から
  // 継続している場合）は既存ユーザーを再利用する。
  const { data: listed, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) {
    throw new Error(
      `テスト用Authユーザーの作成に失敗し、既存ユーザーの一覧取得にも失敗しました: ` +
        `${createError.message} / ${listError.message}`,
    );
  }

  const existing = listed.users.find((user) => user.email === TEST_USER.email);
  if (!existing) {
    throw new Error(`テスト用Authユーザーの作成に失敗しました: ${createError.message}`);
  }

  return existing.id;
}

main()
  .then(() => {
    console.log("E2E seed data inserted.");
  })
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
