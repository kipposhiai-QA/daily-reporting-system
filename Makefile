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

.PHONY: help gcloud-auth setup-apis setup-artifact-registry setup-wif build deploy release

help:
	@echo "make setup-apis                 # 必要なGCP APIを有効化（初回のみ）"
	@echo "make setup-artifact-registry     # Artifact Registryリポジトリを作成（初回のみ）"
	@echo "make setup-wif GITHUB_REPO=org/repo  # Workload Identity FederationとデプロイSAを作成（初回のみ）"
	@echo "make build                       # Cloud BuildでコンテナイメージをビルドしてArtifact Registryへpush"
	@echo "make deploy                      # Cloud Runへデプロイ"
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
	gcloud builds submit \
		--project=$(PROJECT_ID) \
		--tag=$(IMAGE) \
		--suppress-logs \
		.

deploy:
	gcloud run deploy $(SERVICE_NAME) \
		--project=$(PROJECT_ID) \
		--region=$(REGION) \
		--image=$(IMAGE) \
		--platform=managed \
		--allow-unauthenticated \
		--quiet

release: build deploy
