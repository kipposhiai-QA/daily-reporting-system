import { expect, test } from "@playwright/test";
import { PASSWORD_RESET_TEST_USER } from "./fixtures/test-users";

// ローカルのSupabase CLIスタックのメールキャッチャー（Mailpit）のURL。
// `supabase status -o env` の出力する MAILPIT_URL を、.github/workflows/ci.yml の
// e2e ジョブが E2E_MAILPIT_URL としてこのプロセスの環境変数に設定する
// （ローカル実行時は `supabase start` のデフォルトポートをそのまま使う）。
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

const NEW_PASSWORD = "new-password456";

/**
 * Mailpitに届いたパスワード再設定メールから、確認リンク（Supabase Auth
 * `/auth/v1/verify` へのリンク）を取り出す。
 *
 * Mailpitの `/view/latest.html?query=...` はマッチした最新メールのレンダリング済み
 * HTMLをそのまま返す（該当なしの場合は404）。JSON API側のフィールド仕様に依存せず、
 * メール本文中のリンクを正規表現で抜き出すだけで済むためこちらを採用する
 * （参照: https://mailpit.axllent.org/docs/api-v1/）。
 * ローカルのSMTP送信〜Mailpitへの反映には多少のタイムラグがあるため、届くまで
 * ポーリングする。
 */
async function fetchPasswordResetLink(email: string): Promise<string> {
  const query = encodeURIComponent(`to:${email}`);
  const deadline = Date.now() + 20_000;
  let lastStatus: number | undefined;

  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/view/latest.html?query=${query}`);
    if (response.ok) {
      const html = await response.text();
      const match = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/i);
      if (match) return match[1].replace(/&amp;/g, "&");
    }
    lastStatus = response.status;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `パスワード再設定メールの取得に失敗しました（Mailpit: ${MAILPIT_URL}, 最終ステータス: ${lastStatus}）`,
  );
}

test.describe("パスワードリセット", () => {
  test("メール送信→リンク→新パスワード設定→新パスワードでログイン", async ({ page }) => {
    // 1. ログイン画面からリセット申請画面へ
    await page.goto("/login");
    await page.getByRole("link", { name: "パスワードを忘れた方" }).click();
    await expect(page).toHaveURL("/reset-password");

    // 2. メールアドレスを入力して送信
    await page.getByLabel("メールアドレス").fill(PASSWORD_RESET_TEST_USER.email);
    await page.getByRole("button", { name: "リセットメールを送信" }).click();
    await expect(page.getByText("パスワード再設定用のメールを送信しました")).toBeVisible();

    // 3. Mailpitからメールを取得し、確認リンクを抽出
    const resetLink = await fetchPasswordResetLink(PASSWORD_RESET_TEST_USER.email);

    // 4. リンクを開いて新パスワードを設定
    await page.goto(resetLink);
    await expect(page).toHaveURL(/\/reset-password\/confirm/);

    await page.getByLabel("新しいパスワード", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("新しいパスワード（確認）").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "パスワードを更新" }).click();
    await expect(page.getByText("パスワードを更新しました")).toBeVisible();

    await page.getByRole("link", { name: "ログイン画面へ" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // 5. 新パスワードでログインできることを確認
    await page.getByLabel("メールアドレス").fill(PASSWORD_RESET_TEST_USER.email);
    await page.getByLabel("パスワード", { exact: true }).fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByText(`${PASSWORD_RESET_TEST_USER.name}（${PASSWORD_RESET_TEST_USER.roleLabel}）`),
    ).toBeVisible();
  });
});
