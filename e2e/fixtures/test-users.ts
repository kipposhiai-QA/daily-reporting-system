// E2Eテストで使う既知のテストアカウント。
// components/auth/login-form.tsx に表示されているテスト用アカウントのヒントと同じ値を使う。
// prisma/seed-data.ts の sales_person_id=1（山田太郎）に、e2e/global-setup.ts が
// Supabase Authのテストユーザーを auth_user_id で紐付ける。
export const TEST_USER = {
  salesPersonId: 1,
  name: "山田太郎",
  roleLabel: "営業",
  email: "yamada@example.com",
  password: "password123",
} as const;

// パスワードリセットのE2E（e2e/reset-password.spec.ts）専用のテストアカウント。
// TEST_USER は login.spec.ts / report-flow.spec.ts が使い回すため、パスワードを
// 書き換えるテストで共用すると実行順序に依存してしまう。prisma/seed-data.ts に
// 既に存在する sales_person_id=2（田中花子）へ、別のSupabase Authユーザーを紐付けて使う。
export const PASSWORD_RESET_TEST_USER = {
  salesPersonId: 2,
  name: "田中花子",
  roleLabel: "営業",
  email: "tanaka@example.com",
  password: "password123",
} as const;
