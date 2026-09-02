# デプロイ手順（Cloud Run / GitHub Actions）

## 構成概要

- ホスティング: Google Cloud Run
- GCPプロジェクトID: `daily-reporting-system-2026`
- リージョン: `asia-northeast1`（東京）
- コンテナイメージ: Artifact Registry（`daily-reporting-system` リポジトリ）
- ビルド: `docker build` によるローカル（実行環境内）ビルド + `docker push` でArtifact Registryへ配置
  - 当初は Google Cloud Build（`gcloud builds submit`）を使用していたが、CI環境のサービスアカウントで
    ビルドログストリーミング権限エラー（VPC-SC関連）が解消できなかったため、Cloud Buildを使わない
    構成に変更した。Docker Engineが利用可能な環境（GitHub Actionsのubuntu-latest runner含む）であれば
    実行できる。
- CI/CD: GitHub Actions（`.github/workflows/ci.yml`）
  - `push` / `pull_request`（対象: `main`）で lint・format・test・build を実行
  - `main` への `push` 時のみ、`docker build`/`docker push` でイメージをビルド・配置し Cloud Run へデプロイ
- GCP認証: Workload Identity Federation（サービスアカウントキーを保存しない、キーレス認証）
- Cloud Runのアクセス設定: 現時点では `--allow-unauthenticated`（公開）。アプリ側に認証を実装した際に見直すこと。
- DB接続情報（Supabase）: Cloud Runの環境変数として `--set-env-vars` で渡す。詳細は「Supabase接続情報の管理方式」を参照。

デプロイの実コマンドはすべて `Makefile` に集約されている。CI・ローカルどちらからも同じ `make` コマンドを使う。

## Supabase接続情報の管理方式

`DATABASE_URL` / `DIRECT_URL`（`.env.example` 参照）は、Cloud Runの環境変数として `gcloud run deploy --set-env-vars` で渡す方式を採用する。Secret Manager方式（シークレットを作成し `--set-secrets` で参照する）ではなく、この方式を選んだ理由は以下の通り。

- 本プロジェクトは既に `GCP_WORKLOAD_IDENTITY_PROVIDER` / `GCP_SERVICE_ACCOUNT` をGitHub Secretsで管理しており、DB接続情報も同じ経路（GitHub Secrets → CIの環境変数 → Cloud Runの環境変数）に載せる方が運用が一本化される。
- 管理する値が2つのみで、Secret Manager APIの有効化・シークレット作成・Cloud Runランタイムサービスアカウントへの`roles/secretmanager.secretAccessor`付与といった追加のセットアップ手順に見合うメリットが小さい。
- Cloud Runの環境変数はプロジェクトのIAM権限を持つ者にしか見えない（`--allow-unauthenticated`は外部からのHTTPリクエストを許可するだけで、サービス設定の閲覧権限とは別軸）。

将来的に規制対応やシークレットローテーション、監査ログ等が必要になった場合は、Secret Manager方式への移行を検討する（「今後の検討事項」参照）。

**Makefileにはこれらの値をハードコードしない。** `make deploy` / `make release` は環境変数 `DATABASE_URL` / `DIRECT_URL` が設定されていることを前提とし、未設定の場合はエラーで停止する。

- ローカル実行時: `.env` を読み込んでから実行する（例: `set -a; source .env; set +a; make release`）。
- CI実行時: `.github/workflows/ci.yml` の `deploy` ジョブが、GitHub Secretsの `DATABASE_URL` / `DIRECT_URL` を `make release` 実行時の環境変数として渡す。事前にGitHubリポジトリの **Settings → Secrets and variables → Actions** に登録しておくこと（初回セットアップの手順5を参照）。

`--set-env-vars` の値はカンマ区切りのため、接続文字列にカンマを含めることはできない（Supabaseの接続文字列は通常含まない）。Makefile側ではカンマの代わりに `|` を区切り文字とするカスタムデリミタ構文（`^|^KEY1=VAL1|KEY2=VAL2`）を使っている。

## Supabase Auth（ブラウザ用クライアント）接続情報の管理方式

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`（`.env.example` 参照）も同じくGitHub Secrets経由で管理するが、`DATABASE_URL` / `DIRECT_URL` とは渡し方が異なる。

- `NEXT_PUBLIC_` プレフィックスの環境変数は、Next.jsの `next build` 実行時にクライアントバンドルへ値がそのまま埋め込まれる（サーバー側でのみ読まれる `DATABASE_URL` 等とは違い、ビルド後は実行時の環境変数を変えても反映されない）。
- そのため `make build` は、`docker build --build-arg` としてこの2つを渡し、Dockerfileの `builder` ステージ（`RUN npm run build` の直前）で `ENV` に設定してからビルドする。Cloud Runの `--set-env-vars`（`make deploy` 側）では代替できない。

**Makefileにはこれらの値をハードコードしない。** `make build` / `make release` は環境変数 `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が設定されていることを前提とし、未設定の場合はエラーで停止する（ローカル・CIそれぞれの読み込み方は `DATABASE_URL` / `DIRECT_URL` と同様）。

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

さらに、Cloud Runへ渡すDB接続情報として以下の2つも登録する（値は `.env` の同名の変数と同じ。Supabaseダッシュボード > Project Settings > Database > Connection string から取得）。

- `DATABASE_URL`
- `DIRECT_URL`

加えて、Supabase Auth（ブラウザ用クライアント）のビルド時埋め込み情報として以下の2つも登録する（値はSupabaseダッシュボード > Project Settings > API から取得。`NEXT_PUBLIC_SUPABASE_ANON_KEY` はanon keyのみとし、`service_role` key は登録しないこと）。

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

これら6つをGitHubリポジトリの **Settings → Secrets and variables → Actions** に登録する。登録後、`main` ブランチへのpushで自動デプロイが有効になる。

## ローカルから手動デプロイする場合

`make build` / `make deploy` / `make release` はそれぞれ `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`、`DATABASE_URL` / `DIRECT_URL` を環境変数として要求するため、先に `.env` を読み込んでおく。

```bash
# .env を環境変数として読み込む
set -a; source .env; set +a

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
- Supabase（DB）の接続情報は現在Cloud Runの環境変数（`--set-env-vars`、GitHub Secrets経由）で管理している（「Supabase接続情報の管理方式」参照）。シークレットローテーションや監査ログ等の要件が出てきた場合はSecret Manager方式への移行を検討する。
- Cloud Buildを使わない構成に変更したため、`make setup-apis` の `cloudbuild.googleapis.com` 有効化、および
  `make setup-wif` が付与する `roles/cloudbuild.builds.editor` はビルド用途としては不要になった
  （既存環境から外すかは運用上の影響を確認の上で判断する）。
