PROJECT_ID ?= daily-reporting-system-2026
REGION ?= asia-northeast1
SERVICE_NAME ?= daily-reporting-system
AR_REPO ?= daily-reporting-system
IMAGE_TAG ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo latest)
IMAGE := $(REGION)-docker.pkg.dev/$(PROJECT_ID)/$(AR_REPO)/$(SERVICE_NAME):$(IMAGE_TAG)

# Workload Identity Federation setup用（初回のみ）
WIF_POOL ?= github-actions-pool
WIF_PROVIDER ?= github-actions-provider
DEPLOY_SA_NAME ?= github-actions-deployer
DEPLOY_SA_EMAIL := $(DEPLOY_SA_NAME)@$(PROJECT_ID).iam.gserviceaccount.com
GITHUB_REPO ?= # 例: your-org/daily-reporting-system

# DATABASE_URL / DIRECT_URL は機密情報のためMakefileにデフォルト値を書かない。
# `deploy` はこの2つを環境変数として読み取り、Cloud Runの環境変数にそのまま渡す
# （詳細は docs/deployment.md の「Supabase接続情報の管理方式」を参照）。
# - ローカル実行時: `set -a; source .env; set +a` 等で事前に環境変数として読み込んでおく
# - CI実行時: .github/workflows/ci.yml の deploy ジョブがGitHub Secretsから渡す
#
# NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY も同様にMakefileへ書かず、
# `build` が環境変数として読み取って `docker build --build-arg` でDockerfileへ渡す。
# NEXT_PUBLIC_* はNext.jsのビルド時にクライアントバンドルへ埋め込まれるため、
# DATABASE_URL/DIRECT_URLと異なり `deploy` 側（Cloud Runの実行時環境変数）で渡しても反映されない。

.PHONY: help gcloud-auth setup-apis setup-artifact-registry setup-wif build deploy release

help:
	@echo "make setup-apis                 # 必要なGCP APIを有効化（初回のみ）"
	@echo "make setup-artifact-registry     # Artifact Registryリポジトリを作成（初回のみ）"
	@echo "make setup-wif GITHUB_REPO=org/repo  # Workload Identity FederationとデプロイSAを作成（初回のみ）"
	@echo "make build                       # Dockerでコンテナイメージをローカルビルドし、Artifact Registryへpush（事前にNEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEYを環境変数として読み込んでおくこと）"
	@echo "make deploy                      # Cloud Runへデプロイ（事前にDATABASE_URL/DIRECT_URL/SUPABASE_SERVICE_ROLE_KEYを環境変数として読み込んでおくこと）"
	@echo "make release                     # build + deploy をまとめて実行"

gcloud-auth:
	gcloud auth login
	gcloud config set project $(PROJECT_ID)

setup-apis:
	gcloud services enable \
		run.googleapis.com \
		artifactregistry.googleapis.com \
		cloudbuild.googleapis.com \
		iamcredentials.googleapis.com \
		--project=$(PROJECT_ID)

setup-artifact-registry:
	gcloud artifacts repositories create $(AR_REPO) \
		--repository-format=docker \
		--location=$(REGION) \
		--project=$(PROJECT_ID) \
		--description="daily-reporting-system container images"

setup-wif:
	@if [ -z "$(GITHUB_REPO)" ]; then echo "GITHUB_REPO=org/repo を指定してください"; exit 1; fi
	gcloud iam service-accounts create $(DEPLOY_SA_NAME) \
		--project=$(PROJECT_ID) \
		--display-name="GitHub Actions Deployer"
	gcloud projects add-iam-policy-binding $(PROJECT_ID) \
		--member="serviceAccount:$(DEPLOY_SA_EMAIL)" \
		--role="roles/run.admin"
	gcloud projects add-iam-policy-binding $(PROJECT_ID) \
		--member="serviceAccount:$(DEPLOY_SA_EMAIL)" \
		--role="roles/iam.serviceAccountUser"
	gcloud projects add-iam-policy-binding $(PROJECT_ID) \
		--member="serviceAccount:$(DEPLOY_SA_EMAIL)" \
		--role="roles/artifactregistry.writer"
	gcloud projects add-iam-policy-binding $(PROJECT_ID) \
		--member="serviceAccount:$(DEPLOY_SA_EMAIL)" \
		--role="roles/cloudbuild.builds.editor"
	gcloud iam workload-identity-pools create $(WIF_POOL) \
		--project=$(PROJECT_ID) \
		--location="global" \
		--display-name="GitHub Actions Pool"
	gcloud iam workload-identity-pools providers create-oidc $(WIF_PROVIDER) \
		--project=$(PROJECT_ID) \
		--location="global" \
		--workload-identity-pool=$(WIF_POOL) \
		--display-name="GitHub Actions Provider" \
		--attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
		--attribute-condition="assertion.repository=='$(GITHUB_REPO)'" \
		--issuer-uri="https://token.actions.githubusercontent.com"
	gcloud iam service-accounts add-iam-policy-binding $(DEPLOY_SA_EMAIL) \
		--project=$(PROJECT_ID) \
		--role="roles/iam.workloadIdentityUser" \
		--member="principalSet://iam.googleapis.com/projects/$(shell gcloud projects describe $(PROJECT_ID) --format='value(projectNumber)')/locations/global/workloadIdentityPools/$(WIF_POOL)/attribute.repository/$(GITHUB_REPO)"
	@echo ""
	@echo "GitHub Secretsに以下を登録してください:"
	@echo "  GCP_WORKLOAD_IDENTITY_PROVIDER = projects/$(shell gcloud projects describe $(PROJECT_ID) --format='value(projectNumber)')/locations/global/workloadIdentityPools/$(WIF_POOL)/providers/$(WIF_PROVIDER)"
	@echo "  GCP_SERVICE_ACCOUNT            = $(DEPLOY_SA_EMAIL)"

build:
	@if [ -z "$(NEXT_PUBLIC_SUPABASE_URL)" ]; then \
		echo "NEXT_PUBLIC_SUPABASE_URL が設定されていません。ローカルなら .env を読み込む（例: set -a; source .env; set +a）か、"; \
		echo "CIならGitHub Secretsの NEXT_PUBLIC_SUPABASE_URL を確認してください。"; \
		exit 1; \
	fi
	@if [ -z "$(NEXT_PUBLIC_SUPABASE_ANON_KEY)" ]; then \
		echo "NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。ローカルなら .env を読み込む（例: set -a; source .env; set +a）か、"; \
		echo "CIならGitHub Secretsの NEXT_PUBLIC_SUPABASE_ANON_KEY を確認してください。"; \
		exit 1; \
	fi
	docker build \
		--build-arg NEXT_PUBLIC_SUPABASE_URL="$(NEXT_PUBLIC_SUPABASE_URL)" \
		--build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY="$(NEXT_PUBLIC_SUPABASE_ANON_KEY)" \
		-t $(IMAGE) .
	gcloud auth configure-docker $(REGION)-docker.pkg.dev --project=$(PROJECT_ID) --quiet
	docker push $(IMAGE)

deploy:
	@if [ -z "$(DATABASE_URL)" ]; then \
		echo "DATABASE_URL が設定されていません。ローカルなら .env を読み込む（例: set -a; source .env; set +a）か、"; \
		echo "CIならGitHub Secretsの DATABASE_URL を確認してください。"; \
		exit 1; \
	fi
	@if [ -z "$(DIRECT_URL)" ]; then \
		echo "DIRECT_URL が設定されていません。ローカルなら .env を読み込む（例: set -a; source .env; set +a）か、"; \
		echo "CIならGitHub Secretsの DIRECT_URL を確認してください。"; \
		exit 1; \
	fi
	@if [ -z "$(SUPABASE_SERVICE_ROLE_KEY)" ]; then \
		echo "SUPABASE_SERVICE_ROLE_KEY が設定されていません。ローカルなら .env を読み込む（例: set -a; source .env; set +a）か、"; \
		echo "CIならGitHub Secretsの SUPABASE_SERVICE_ROLE_KEY を確認してください。"; \
		exit 1; \
	fi
	gcloud run deploy $(SERVICE_NAME) \
		--project=$(PROJECT_ID) \
		--region=$(REGION) \
		--image=$(IMAGE) \
		--platform=managed \
		--allow-unauthenticated \
		--set-env-vars="^|^DATABASE_URL=$(DATABASE_URL)|DIRECT_URL=$(DIRECT_URL)|SUPABASE_SERVICE_ROLE_KEY=$(SUPABASE_SERVICE_ROLE_KEY)" \
		--quiet

release: build deploy
