import { expect, test } from "@playwright/test";
import { LOGOUT_TEST_USER, TEST_USER } from "./fixtures/test-users";

test.describe("ログイン→ログアウト", () => {
  test.describe.configure({ mode: "serial" });
  test("正しいメールアドレス・パスワードでログインでき、ログアウトするとログイン画面に戻る", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("メールアドレス").fill(LOGOUT_TEST_USER.email);
    await page.getByLabel("パスワード", { exact: true }).fill(LOGOUT_TEST_USER.password);
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByText(`${LOGOUT_TEST_USER.name}（${LOGOUT_TEST_USER.roleLabel}）`),
    ).toBeVisible();

    await page.getByRole("button", { name: "ログアウト" }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "営業日報システム" })).toBeVisible();
  });

  test("誤ったパスワードではログインできず、エラーメッセージが表示される", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("メールアドレス").fill(TEST_USER.email);
    await page.getByLabel("パスワード", { exact: true }).fill("wrong-password");
    await page.getByRole("button", { name: "ログイン" }).click();

    // getByRole("alert") はNext.jsが全ページに挿入するルート変更通知用の
    // <div role="alert" id="__next-route-announcer__"> ともマッチしてしまうため、
    // エラーメッセージのテキストで直接特定する。
    await expect(page.getByText("メールアドレスまたはパスワードが正しくありません")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  const invalidLoginCases = [
    {
      label: "メールアドレスが空の場合",
      email: "",
      password: TEST_USER.password,
      expectedError: "メールアドレスを入力してください",
    },
    {
      label: "パスワードが空の場合",
      email: TEST_USER.email,
      password: "",
      expectedError: "パスワードを入力してください",
    },
  ];

  for (const { label, email, password, expectedError } of invalidLoginCases) {
    test(`${label}、エラーメッセージが表示される`, async ({ page }) => {
      await page.goto("/login");

      if (email) await page.getByLabel("メールアドレス").fill(email);
      if (password) await page.getByLabel("パスワード", { exact: true }).fill(password);
      await page.getByRole("button", { name: "ログイン" }).click();

      await expect(page.getByText(expectedError)).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("メールアドレスの形式が不正な場合、フォーム送信がブロックされる", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("メールアドレス").fill("test");
    await page.getByLabel("パスワード", { exact: true }).fill(TEST_USER.password);
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL(/\/login$/);
  });
});
