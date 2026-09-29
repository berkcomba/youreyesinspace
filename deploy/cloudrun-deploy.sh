#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Build the container with Cloud Build and deploy it to Cloud Run.
#
#   export GCP_PROJECT=my-project
#   export ORIGIN_AUTH_SECRET="$(openssl rand -hex 24)"   # keep it; Cloudflare needs the same value
#   ./deploy/cloudrun-deploy.sh
#
# Optional env: GCP_REGION (default europe-west1), SERVICE (default youreyesinthespace),
#               MIN_INSTANCES (default 0), MAX_INSTANCES (default 4)
# ---------------------------------------------------------------------------
set -euo pipefail

: "${GCP_PROJECT:?GCP_PROJECT ayarlanmalı}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE="${SERVICE:-youreyesinthespace}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-4}"
BUILD_ID="$(git rev-parse --short HEAD 2>/dev/null || date +%s)"
IMAGE="${REGION}-docker.pkg.dev/${GCP_PROJECT}/web/${SERVICE}:${BUILD_ID}"

echo "▶ Artifact Registry deposu (varsa atlanır)"
gcloud artifacts repositories describe web --location="${REGION}" --project="${GCP_PROJECT}" >/dev/null 2>&1 \
  || gcloud artifacts repositories create web --repository-format=docker --location="${REGION}" --project="${GCP_PROJECT}"

echo "▶ Cloud Build: ${IMAGE}"
gcloud builds submit --project="${GCP_PROJECT}" --config=deploy/cloudbuild.yaml \
  --substitutions=_IMAGE="${IMAGE}",_BUILD_ID="${BUILD_ID}" .

echo "▶ Cloud Run deploy: ${SERVICE} (${REGION})"
ENV_VARS="BUILD_ID=${BUILD_ID}"
if [[ -n "${ORIGIN_AUTH_SECRET:-}" ]]; then
  ENV_VARS="${ENV_VARS},ORIGIN_AUTH_SECRET=${ORIGIN_AUTH_SECRET}"
else
  echo "⚠ ORIGIN_AUTH_SECRET boş: Cloud Run URL'si doğrudan erişilebilir olur (Cloudflare bypass)."
fi

gcloud run deploy "${SERVICE}" \
  --project="${GCP_PROJECT}" \
  --region="${REGION}" \
  --image="${IMAGE}" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --cpu=1 --memory=256Mi \
  --concurrency=200 \
  --min-instances="${MIN_INSTANCES}" \
  --max-instances="${MAX_INSTANCES}" \
  --ingress=all \
  --set-env-vars="${ENV_VARS}"

URL="$(gcloud run services describe "${SERVICE}" --project="${GCP_PROJECT}" --region="${REGION}" --format='value(status.url)')"
echo
echo "✔ Yayında: ${URL}"
echo "  Sağlık:   ${URL}/_health"
echo "  Sonraki adım: deploy/cloudflare.md → alan adını Cloudflare üzerinden bu servise yönlendir."
