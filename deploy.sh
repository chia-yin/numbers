#!/usr/bin/env bash
# Build container image, push to Artifact Registry, deploy to Cloud Run.
# Configuration: copy .workflow/deploy.env.example → .workflow/deploy.env and fill in values.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"
ENV_FILE="$REPO_ROOT/.workflow/deploy.env"

die() {
  echo "錯誤: $*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "找不到指令 '$1'，請先安裝後再執行 deploy.sh"
}

load_deploy_env() {
  if [[ ! -f "$ENV_FILE" ]]; then
    cat >&2 <<EOF
錯誤: 找不到部署設定檔 $ENV_FILE

請先建立設定檔：
  cp .workflow/deploy.env.example .workflow/deploy.env
  # 編輯 .workflow/deploy.env，填入 GCP 專案 ID、region、服務名稱等必填欄位
EOF
    exit 1
  fi

  # shellcheck disable=SC1090
  set -a
  source "$ENV_FILE"
  set +a
}

validate_required_vars() {
  local missing=()
  local var

  for var in GCP_PROJECT_ID GCP_REGION SERVICE_NAME ARTIFACT_REGISTRY_LOCATION ARTIFACT_REGISTRY_REPOSITORY; do
    if [[ -z "${!var:-}" ]]; then
      missing+=("$var")
    fi
  done

  if ((${#missing[@]} > 0)); then
    cat >&2 <<EOF
錯誤: $ENV_FILE 缺少必填欄位：
$(printf '  - %s\n' "${missing[@]}")

請參考 .workflow/deploy.env.example 補齊後再執行。
詳細說明見 .workflow/DEPLOY.md
EOF
    exit 1
  fi
}

ensure_gcloud_project() {
  local current_project
  current_project="$(gcloud config get-value project 2>/dev/null || true)"
  if [[ -n "$current_project" && "$current_project" != "$GCP_PROJECT_ID" ]]; then
    echo "提示: 目前 gcloud 專案為 '$current_project'，將改用 deploy.env 的 GCP_PROJECT_ID='$GCP_PROJECT_ID'"
  fi
}

enable_apis() {
  echo "==> 啟用必要 GCP API（可重複執行）"
  gcloud services enable \
    artifactregistry.googleapis.com \
    run.googleapis.com \
    secretmanager.googleapis.com \
    --project="$GCP_PROJECT_ID"
}

ensure_artifact_repository() {
  local registry_host="${ARTIFACT_REGISTRY_LOCATION}-docker.pkg.dev"

  if gcloud artifacts repositories describe "$ARTIFACT_REGISTRY_REPOSITORY" \
    --location="$ARTIFACT_REGISTRY_LOCATION" \
    --project="$GCP_PROJECT_ID" >/dev/null 2>&1; then
    echo "==> Artifact Registry 儲存庫已存在: $ARTIFACT_REGISTRY_REPOSITORY"
    return
  fi

  echo "==> 建立 Artifact Registry 儲存庫: $ARTIFACT_REGISTRY_REPOSITORY"
  gcloud artifacts repositories create "$ARTIFACT_REGISTRY_REPOSITORY" \
    --repository-format=docker \
    --location="$ARTIFACT_REGISTRY_LOCATION" \
    --description="Container images for ${SERVICE_NAME}" \
    --project="$GCP_PROJECT_ID"
}

configure_docker_auth() {
  local registry_host="${ARTIFACT_REGISTRY_LOCATION}-docker.pkg.dev"
  echo "==> 設定 Docker 認證: $registry_host"
  gcloud auth configure-docker "$registry_host" --quiet
}

resolve_image_tag() {
  if [[ -n "${IMAGE_TAG:-}" ]]; then
    echo "$IMAGE_TAG"
    return
  fi

  if git -C "$REPO_ROOT" rev-parse --short HEAD >/dev/null 2>&1; then
    git -C "$REPO_ROOT" rev-parse --short HEAD
    return
  fi

  date -u +%Y%m%d%H%M%S
}

build_and_push_image() {
  local image_tag image_uri registry_host
  image_tag="$(resolve_image_tag)"
  registry_host="${ARTIFACT_REGISTRY_LOCATION}-docker.pkg.dev"
  image_uri="${registry_host}/${GCP_PROJECT_ID}/${ARTIFACT_REGISTRY_REPOSITORY}/${SERVICE_NAME}:${image_tag}"

  echo "==> 建置映像: $image_uri"
  docker build -t "$image_uri" "$REPO_ROOT"

  echo "==> 推送映像"
  docker push "$image_uri"

  DEPLOY_IMAGE_URI="$image_uri"
}

deploy_cloud_run() {
  local deploy_args=(
    run deploy "$SERVICE_NAME"
    --image="$DEPLOY_IMAGE_URI"
    --region="$GCP_REGION"
    --project="$GCP_PROJECT_ID"
    --platform=managed
    --port=3000
  )

  if [[ "${CLOUD_RUN_ALLOW_UNAUTHENTICATED:-true}" == "true" ]]; then
    deploy_args+=(--allow-unauthenticated)
  else
    deploy_args+=(--no-allow-unauthenticated)
  fi

  if [[ -n "${CLOUD_RUN_CPU:-}" ]]; then
    deploy_args+=(--cpu="$CLOUD_RUN_CPU")
  fi

  if [[ -n "${CLOUD_RUN_MEMORY:-}" ]]; then
    deploy_args+=(--memory="$CLOUD_RUN_MEMORY")
  fi

  if [[ -n "${CLOUD_RUN_MIN_INSTANCES:-}" ]]; then
    deploy_args+=(--min-instances="$CLOUD_RUN_MIN_INSTANCES")
  fi

  if [[ -n "${CLOUD_RUN_MAX_INSTANCES:-}" ]]; then
    deploy_args+=(--max-instances="$CLOUD_RUN_MAX_INSTANCES")
  fi

  local env_vars="NODE_ENV=production"
  if [[ -n "${CLOUD_RUN_ENV_VARS:-}" ]]; then
    env_vars="${env_vars},${CLOUD_RUN_ENV_VARS}"
  fi
  deploy_args+=(--set-env-vars="$env_vars")

  if [[ -n "${CLOUD_RUN_SECRETS:-}" ]]; then
    deploy_args+=(--set-secrets="$CLOUD_RUN_SECRETS")
  fi

  echo "==> 部署至 Cloud Run: $SERVICE_NAME ($GCP_REGION)"
  gcloud "${deploy_args[@]}"
}

main() {
  require_cmd gcloud
  require_cmd docker

  load_deploy_env
  validate_required_vars
  ensure_gcloud_project
  enable_apis
  ensure_artifact_repository
  configure_docker_auth
  build_and_push_image
  deploy_cloud_run

  echo
  echo "部署完成。"
  gcloud run services describe "$SERVICE_NAME" \
    --region="$GCP_REGION" \
    --project="$GCP_PROJECT_ID" \
    --format='value(status.url)'
}

main "$@"
