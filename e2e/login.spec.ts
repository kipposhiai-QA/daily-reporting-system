import { expect, test } from "@playwright/test";
import { TEST_USER } from "./fixtures/test-users";

test.describe("ログイン→ログアウト", () => {
  test("正しいメールアドレス・パスワードでログインでき、ログアウトするとログイン画面に戻る", async ({
    page,
  }) => {
    await page.goto("/login");

    await page.getByLabel("メールアドレス").fill(TEST_USER.email);
    await page.getByLabel("パスワード", { exact: true }).fill(TEST_USER.password);
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL("/");
    await expect(page.getByText(`${TEST_USER.name}（${TEST_USER.roleLabel}）`)).toBeVisible();

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
});
