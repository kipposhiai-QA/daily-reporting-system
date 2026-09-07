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
