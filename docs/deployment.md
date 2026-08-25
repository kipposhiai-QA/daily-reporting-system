# デプロイ手順（Cloud Run / GitHub Actions）

## 構成概要

- ホスティング: Google Cloud Run
- GCPプロジェクトID: `daily-reporting-system-2026`
- リージョン: `asia-northeast1`（東京）
- コンテナイメージ: Artifact Registry（`daily-reporting-system` リポジトリ）
- ビルド: Google Cloud Build（`gcloud builds submit`、ローカルにDockerが無くても実行可能）
- CI/CD: GitHub Actions（`.github/workflows/ci.yml`）
  - `push` / `pull_request`（対象: `main`）で lint・format・test・build を実行
  - `main` への `push` 時のみ、Cloud Buildでイメージをビルドし Cloud Run へデプロイ
- GCP認証: Workload Identity Federation（サービスアカウントキーを保存しない、キーレス認証）
- Cloud Runのアクセス設定: 現時点では `--allow-unauthenticated`（公開）。アプリ側に認証を実装した際に見直すこと。

デプロイの実コマンドはすべて `Makefile` に集約されている。CI・ローカルどちらからも同じ `make` コマンドを使う。

## 初回セットアップ（1度だけ実行）

以下は、このリポジトリをGitHubにpushし、GCPプロジェクト `daily-reporting-system-2026` に対して十分な権限（オーナー相当）を持つアカウントで実行する。

```bash
# 1. gcloud にログインし、対象プロジェクトを選択
make gcloud-auth PROJECT_ID=daily-reporting-system-2026

# 2. 必要なAPIを有効化
make setup-apis PROJECT_ID=daily-reporting-system-2026

# 3. コンテナイメージ用のArtifact Registryリポジトリを作成
make setup-artifact-registry PROJECT_ID=daily-reporting-system-2026 REGION=asia-northeast1

# 4. Workload Identity Federation + デプロイ用サービスアカウントを作成
#    GITHUB_REPO は "org/repo" 形式（例: your-org/daily-reporting-system）
make setup-wif PROJECT_ID=daily-reporting-system-2026 GITHUB_REPO=<org>/<repo>
```

`make setup-wif` の最後に、GitHub Secretsに登録すべき2つの値が出力される。

- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_SERVICE_ACCOUNT`

これらをGitHubリポジトリの **Settings → Secrets and variables → Actions** に登録する。登録後、`main` ブランチへのpushで自動デプロイが有効になる。

## ローカルから手動デプロイする場合

```bash
# ビルド + デプロイをまとめて実行
make release PROJECT_ID=daily-reporting-system-2026 REGION=asia-northeast1

# ビルドとデプロイを個別に実行したい場合
make build PROJECT_ID=daily-reporting-system-2026
make deploy PROJECT_ID=daily-reporting-system-2026 REGION=asia-northeast1
```

`PROJECT_ID` / `REGION` はMakefile内でデフォルト値（`daily-reporting-system-2026` / `asia-northeast1`）を持っているため、通常は省略して `make release` だけで良い。

## 今後の検討事項

- アプリに認証を実装した段階で、Cloud Runのアクセス設定（`--allow-unauthenticated`）を見直す（IAM認証 + Identity-Aware Proxy、または独自認証+公開の組み合わせなど）。
- ステージング環境が必要になった場合、`SERVICE_NAME` を分けて（例: `daily-reporting-system-staging`）別サービスとしてデプロイする運用を検討する。
- Supabase（DB）の接続情報は、Cloud Runの環境変数 or Secret Managerで管理する（本書はアプリ本体未実装のため未定義。実装時に追記する）。
