import { expect, test } from "@playwright/test";
import { PASSWORD_RESET_TEST_USER } from "./fixtures/test-users";

// ローカルのSupabase CLIスタックのメールキャッチャー（Mailpit）のURL。
// `supabase status -o env` の出力する MAILPIT_URL を、.github/workflows/ci.yml の
// e2e ジョブが E2E_MAILPIT_URL としてこのプロセスの環境変数に設定する
// （ローカル実行時は `supabase start` のデフォルトポートをそのまま使う）。
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:54324";

const NONEXISTENT_EMAIL = "nonexistent-user@example.com";

// components/auth/update-password-form.tsx の LINK_EXPIRED_MESSAGE と同一文言。
// same_password / weak_password 以外のエラー（無効/期限切れ/使用済みリンクなど、
// 有効な回復セッションが存在しない場合を含む）はすべてこのメッセージに集約される。
const LINK_EXPIRED_MESSAGE =
  "パスワードの更新に失敗しました。リンクの有効期限が切れている可能性があります。もう一度パスワード再設定をお試しください";

/**
 * 指定メールアドレス宛の、現時点でのMailpit上の最新メッセージIDを取得する
 * （該当メールが1通もなければnull）。新規リクエスト前に呼び、後続の
 * fetchPasswordResetLink() の excludeMessageId に渡すことで、「まだ届いていない
 * 新しいメールではなく、以前のテストで送信済みの古いメール（かつ既に使用済みの
 * リンク）を誤って掴んでしまう」レースコンディションを防ぐ。
 * 同じテストファイル内で同一メールアドレス（PASSWORD_RESET_TEST_USER）宛に
 * 複数回リセット申請するため、このガードが無いと再利用リンクのテストなどで
 * 古いメールを取得してしまうことがある。
 */
async function getLatestMailpitMessageId(email: string): Promise<string | null> {
  const query = encodeURIComponent(`to:${email}`);
  const response = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=1`);
  if (!response.ok) return null;
  const data = (await response.json()) as { messages?: Array<{ ID: string }> };
  return data.messages?.[0]?.ID ?? null;
}

/**
 * Mailpitに届いたパスワード再設定メールから、確認リンク（Supabase Auth
 * `/auth/v1/verify` へのリンク）を取り出す。
 *
 * `/api/v1/search` でメールアドレス宛の最新メッセージIDを取得し、そのIDが
 * excludeMessageId（リクエスト前時点の最新ID）と異なる場合のみ、そのメッセージを
 * `/view/{ID}.html` で取得して確認リンクを抜き出す。IDが一致する間は「まだ新しい
 * メールが届いていない」とみなしてポーリングを続ける（参照:
 * https://mailpit.axllent.org/docs/api-v1/）。
 * ローカルのSMTP送信〜Mailpitへの反映には多少のタイムラグがあるため、届くまで
 * ポーリングする。
 *
 * excludeMessageId: getLatestMailpitMessageId() で事前に取得した「リクエスト前の
 *   最新メッセージID」。省略時（null）は常に最新メッセージを対象にする（そのメール
 *   アドレス宛の送信がテスト内で初めての場合はこれで問題ない）。
 * timeoutMs: 「メールが送信されないこと」を確認したいテスト（存在しないメール
 *   アドレス宛のケース）向けに、待機時間を短く指定できるようにしている。
 */
async function fetchPasswordResetLink(
  email: string,
  options: { excludeMessageId?: string | null; timeoutMs?: number } = {},
): Promise<string> {
  const { excludeMessageId = null, timeoutMs = 20_000 } = options;
  const query = encodeURIComponent(`to:${email}`);
  const deadline = Date.now() + timeoutMs;
  let lastStatus: number | undefined;

  while (Date.now() < deadline) {
    const searchResponse = await fetch(`${MAILPIT_URL}/api/v1/search?query=${query}&limit=1`);
    if (searchResponse.ok) {
      const data = (await searchResponse.json()) as { messages?: Array<{ ID: string }> };
      const latestId = data.messages?.[0]?.ID;
      if (latestId && latestId !== excludeMessageId) {
        const viewResponse = await fetch(`${MAILPIT_URL}/view/${latestId}.html`);
        if (viewResponse.ok) {
          const html = await viewResponse.text();
          const match = html.match(/href="([^"]*\/auth\/v1\/verify[^"]*)"/i);
          if (match) return match[1].replace(/&amp;/g, "&");
        }
      }
    } else {
      lastStatus = searchResponse.status;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `パスワード再設定メールの取得に失敗しました（Mailpit: ${MAILPIT_URL}, 最終ステータス: ${lastStatus}）`,
  );
}

/** リセット申請画面からメールアドレスを送信し、送信完了メッセージの表示まで確認する */
async function requestPasswordReset(page: import("@playwright/test").Page, email: string) {
  await page.goto("/reset-password");
  await page.getByLabel("メールアドレス").fill(email);
  await page.getByRole("button", { name: "リセットメールを送信" }).click();
  await expect(page.getByText("パスワード再設定用のメールを送信しました")).toBeVisible();
}

/**
 * リセット申請を行い、新しく届いたメールから確認リンクを取得するまでを一度に行う。
 * 同一メールアドレス宛に複数回申請するテスト（このファイル内で共有している
 * PASSWORD_RESET_TEST_USER）で、以前送信済みの古いメールを誤って掴まないよう、
 * 申請前に最新メッセージIDを控えてから申請・取得を行う。
 */
async function requestPasswordResetAndGetLink(
  page: import("@playwright/test").Page,
  email: string,
): Promise<string> {
  const previousMessageId = await getLatestMailpitMessageId(email);
  await requestPasswordReset(page, email);
  return fetchPasswordResetLink(email, { excludeMessageId: previousMessageId });
}

/** 実行のたびに一意なパスワードを生成する。既にこのアカウントに設定されている
 * パスワードと衝突すると、Supabase Authの same_password バリデーションに
 * 引っかかってしまうため（このファイル内でPASSWORD_RESET_TEST_USERを使い回す
 * 複数テスト間、およびPlaywrightのリトライ間で固定値を使うと発生し得る）。
 */
function uniquePassword(label: string): string {
  return `${label}-${Date.now()}`;
}

/** 新パスワード設定フォームに入力して送信する */
async function submitNewPassword(page: import("@playwright/test").Page, password: string) {
  await page.getByLabel("新しいパスワード", { exact: true }).fill(password);
  await page.getByLabel("新しいパスワード（確認）").fill(password);
  await page.getByRole("button", { name: "パスワードを更新" }).click();
}

test.describe("パスワードリセット", () => {
  test("メール送信→リンク→新パスワード設定→新パスワードでログイン", async ({ page }) => {
    // 1. ログイン画面からリセット申請画面へ
    await page.goto("/login");
    await page.getByRole("link", { name: "パスワードを忘れた方" }).click();
    await expect(page).toHaveURL("/reset-password");

    // 2. メールアドレスを入力して送信
    const previousMessageId = await getLatestMailpitMessageId(PASSWORD_RESET_TEST_USER.email);
    await page.getByLabel("メールアドレス").fill(PASSWORD_RESET_TEST_USER.email);
    await page.getByRole("button", { name: "リセットメールを送信" }).click();
    await expect(page.getByText("パスワード再設定用のメールを送信しました")).toBeVisible();

    // 3. Mailpitからメールを取得し、確認リンクを抽出
    const resetLink = await fetchPasswordResetLink(PASSWORD_RESET_TEST_USER.email, {
      excludeMessageId: previousMessageId,
    });

    // 4. リンクを開いて新パスワードを設定
    const password = uniquePassword("main-flow");
    await page.goto(resetLink);
    await expect(page).toHaveURL(/\/reset-password\/confirm/);

    await page.getByLabel("新しいパスワード", { exact: true }).fill(password);
    await page.getByLabel("新しいパスワード（確認）").fill(password);
    await page.getByRole("button", { name: "パスワードを更新" }).click();
    await expect(page.getByText("パスワードを更新しました")).toBeVisible();

    await page.getByRole("link", { name: "ログイン画面へ" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // 5. 新パスワードでログインできることを確認
    await page.getByLabel("メールアドレス").fill(PASSWORD_RESET_TEST_USER.email);
    await page.getByLabel("パスワード", { exact: true }).fill(password);
    await page.getByRole("button", { name: "ログイン" }).click();

    await expect(page).toHaveURL("/");
    await expect(
      page.getByText(`${PASSWORD_RESET_TEST_USER.name}（${PASSWORD_RESET_TEST_USER.roleLabel}）`),
    ).toBeVisible();
  });

  test("存在しないメールアドレスでも同じ成功メッセージを表示する（アカウント列挙対策）", async ({
    page,
  }) => {
    // 未登録のメールアドレスで申請しても、登録済みメールと全く同じ成功メッセージが
    // 表示されることを確認する。応答を変えてしまうと、第三者が総当たりで登録済み
    // アカウントのメールアドレスを推測できてしまう（アカウント列挙攻撃）。
    await requestPasswordReset(page, NONEXISTENT_EMAIL);

    // 画面上のメッセージが同一であることに加え、実際にはメールが送信されていない
    // ことも確認する（短いタイムアウトでポーリングし、届かないことを期待する）。
    await expect(fetchPasswordResetLink(NONEXISTENT_EMAIL, { timeoutMs: 3_000 })).rejects.toThrow();
  });

  test("使用済みのリンクを再度開いた場合はパスワードを更新できない（リンク再利用対策）", async ({
    page,
  }) => {
    const resetLink = await requestPasswordResetAndGetLink(page, PASSWORD_RESET_TEST_USER.email);

    // 1回目: リンクを使って正常にパスワードを更新する。
    // このアカウントの「現在のパスワード」と同じ値を指定するとSupabase Authの
    // same_password バリデーションで拒否されてしまうため、他のテストや過去の
    // リトライで使われた値と衝突しないよう毎回一意な値を生成する。
    await page.goto(resetLink);
    await expect(page).toHaveURL(/\/reset-password\/confirm/);
    await submitNewPassword(page, uniquePassword("reuse-link-1st"));
    await expect(page.getByText("パスワードを更新しました")).toBeVisible();

    // 2回目: 同じリンクをもう一度開いてパスワード更新を試みる。
    // リンク（Supabase Authの回復トークン）は1回使い切ると無効になるため、
    // 2回目の訪問では有効な回復セッションが確立されず更新に失敗するはず。
    await page.goto(resetLink);
    await submitNewPassword(page, uniquePassword("reuse-link-2nd"));
    await expect(page.getByText(LINK_EXPIRED_MESSAGE)).toBeVisible();
  });

  test("無効・期限切れのリンクからはパスワードを更新できない", async ({ page }) => {
    const resetLink = await requestPasswordResetAndGetLink(page, PASSWORD_RESET_TEST_USER.email);

    // トークン部分を改ざんし、期限切れ・不正なリンクを開いた状況を再現する。
    // Supabase Auth側では「期限切れ」と「不正なトークン」を同じ無効トークンエラー
    // として扱うため、有効な回復セッションが確立されない状況の再現として代替する。
    const invalidLink = resetLink.replace(/token=[^&]+/, "token=invalid-token-00000000");

    await page.goto(invalidLink);
    await submitNewPassword(page, uniquePassword("invalid-link"));
    await expect(page.getByText(LINK_EXPIRED_MESSAGE)).toBeVisible();
  });
});
