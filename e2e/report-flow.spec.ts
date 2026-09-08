import { expect, test, type Page } from "@playwright/test";
import { TEST_USER } from "./fixtures/test-users";

// 前提データ（prisma/seed-data.ts, docs/test-specification.md 2.2）には
// sales_person_id=1（山田太郎）の日報として report_date=2026-08-24/2026-08-25 が
// 既に存在するため、(sales_person_id, report_date) の一意制約に抵触しないよう
// それらとは異なる固定日付を使う。
const REPORT_DATE = "2026-09-01";

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(TEST_USER.email);
  await page.getByLabel("パスワード", { exact: true }).fill(TEST_USER.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("/");
}

test.describe("日報の作成→一覧→詳細", () => {
  test("訪問記録を入力して提出すると、一覧・詳細に反映される", async ({ page }) => {
    await login(page);

    // SCR-01: 一覧から新規作成へ
    await page.goto("/reports");
    await page.getByRole("link", { name: "＋新規作成" }).click();
    await expect(page).toHaveURL("/reports/new");

    // SCR-02: 対象日・訪問記録・Problem・Planを入力
    await page.getByLabel("対象日").fill(REPORT_DATE);

    await page.getByRole("button", { name: "＋訪問記録を追加" }).click();
    await page.getByLabel("訪問記録1件目の顧客").click();
    await page.getByRole("option", { name: "株式会社A社" }).click();
    await page.getByLabel("訪問記録1件目の訪問内容").fill("新商品の提案を実施");
    await page.getByLabel("訪問記録1件目の訪問時刻").fill("10:00");

    await page.getByLabel("Problem（課題・相談）").fill("A社の見積もり承認が遅れている");
    await page.getByLabel("Plan（明日やること）").fill("C社へ初回訪問予定");

    await page.getByRole("button", { name: "提出する" }).click();

    // 保存後はSCR-01へ戻る
    await expect(page).toHaveURL("/reports");

    // SCR-01: 作成した日報が一覧に表示される
    const row = page.getByRole("row", { name: new RegExp(REPORT_DATE) });
    await expect(row).toBeVisible();
    await expect(row.getByText("提出済み")).toBeVisible();
    await expect(row.getByText("1件")).toBeVisible();

    // SCR-03: 一覧から詳細へ遷移し、入力内容が表示される
    await row.click();
    await expect(page).toHaveURL(/\/reports\/\d+$/);

    await expect(page.getByText(`${REPORT_DATE} / ${TEST_USER.name}`)).toBeVisible();
    await expect(page.getByText("提出済み")).toBeVisible();
    await expect(page.getByText("株式会社A社 — 新商品の提案を実施")).toBeVisible();
    await expect(page.getByText("A社の見積もり承認が遅れている")).toBeVisible();
    await expect(page.getByText("C社へ初回訪問予定")).toBeVisible();
  });

  test("訪問記録なしで下書き保存すると、一覧・詳細に下書きとして反映される", async ({ page }) => {
    await login(page);

    const draftDate = "2026-09-02";

    await page.goto("/reports/new");
    await page.getByLabel("対象日").fill(draftDate);
    await page.getByLabel("Problem（課題・相談）").fill("特になし");

    await page.getByRole("button", { name: "下書き保存" }).click();

    await expect(page).toHaveURL("/reports");

    const row = page.getByRole("row", { name: new RegExp(draftDate) });
    await expect(row).toBeVisible();
    await expect(row.getByText("下書き")).toBeVisible();
    await expect(row.getByText("0件")).toBeVisible();

    await row.click();
    await expect(page).toHaveURL(/\/reports\/\d+$/);
    await expect(page.getByText(`${draftDate} / ${TEST_USER.name}`)).toBeVisible();
    await expect(page.getByText("下書き")).toBeVisible();
    await expect(page.getByText("訪問記録はありません")).toBeVisible();
    await expect(page.getByText("特になし")).toBeVisible();
  });
});
