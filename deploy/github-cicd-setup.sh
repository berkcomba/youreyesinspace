#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# One-time setup for keyless GitHub Actions → Google Cloud deploys
# (Workload Identity Federation; no service-account JSON keys anywhere).
#
#   export GCP_PROJECT=my-project
#   export GITHUB_REPO=owner/name          # the repository that runs .github/workflows/deploy.yml
#   ./deploy/github-cicd-setup.sh
#
# Creates (idempotent):
#   • service account github-deployer@<project> with the roles needed by deploy/cloudrun-deploy.sh
#   • workload identity pool "github" + OIDC provider "github", restricted to GITHUB_REPO
#   • GitHub Actions repository variables GCP_PROJECT, GCP_WIF_PROVIDER, GCP_SERVICE_ACCOUNT (via gh)
# Optional: GCP_REGION (default europe-west1), CLOUD_RUN_SERVICE (default youreyesinthespace)
# ---------------------------------------------------------------------------
set -euo pipefail

: "${GCP_PROJECT:?GCP_PROJECT ayarlanmalı}"
: "${GITHUB_REPO:?GITHUB_REPO ayarlanmalı (owner/name)}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE="${CLOUD_RUN_SERVICE:-youreyesinthespace}"
POOL="github"
PROVIDER="github"
SA_NAME="github-deployer"
SA="${SA_NAME}@${GCP_PROJECT}.iam.gserviceaccount.com"

PROJECT_NUMBER="$(gcloud projects describe "${GCP_PROJECT}" --format='value(projectNumber)')"

echo "▶ API'ler"
gcloud services enable iamcredentials.googleapis.com sts.googleapis.com iam.googleapis.com \
  run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com --project="${GCP_PROJECT}"

echo "▶ Servis hesabı ${SA}"
gcloud iam service-accounts describe "${SA}" --project="${GCP_PROJECT}" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "${SA_NAME}" --project="${GCP_PROJECT}" \
       --display-name="GitHub Actions deployer (${GITHUB_REPO})"

# Roles used by deploy/cloudrun-deploy.sh:
#   run.admin                 deploy/describe the Cloud Run service
#   iam.serviceAccountUser    act as the runtime / Cloud Build service accounts
#   cloudbuild.builds.editor  submit builds
#   artifactregistry.writer   push the image (repo create is done once by hand / first manual deploy)
#   storage.admin             upload the build source to the *_cloudbuild bucket
#   serviceusage.serviceUsageConsumer  quota project for API calls
for role in roles/run.admin roles/iam.serviceAccountUser roles/cloudbuild.builds.editor \
            roles/artifactregistry.writer roles/storage.admin roles/serviceusage.serviceUsageConsumer; do
  gcloud projects add-iam-policy-binding "${GCP_PROJECT}" --member="serviceAccount:${SA}" --role="${role}" \
    --condition=None --quiet >/dev/null
  echo "   ${role}"
done

echo "▶ Workload Identity Pool / Provider"
gcloud iam workload-identity-pools describe "${POOL}" --location=global --project="${GCP_PROJECT}" >/dev/null 2>&1 \
  || gcloud iam workload-identity-pools create "${POOL}" --location=global --project="${GCP_PROJECT}" \
       --display-name="GitHub Actions"

if gcloud iam workload-identity-pools providers describe "${PROVIDER}" --workload-identity-pool="${POOL}" \
     --location=global --project="${GCP_PROJECT}" >/dev/null 2>&1; then
  ACTION=update
else
  ACTION=create-oidc
fi
gcloud iam workload-identity-pools providers "${ACTION}" "${PROVIDER}" \
  --workload-identity-pool="${POOL}" --location=global --project="${GCP_PROJECT}" \
  --display-name="GitHub OIDC" \
  $([[ "${ACTION}" == create-oidc ]] && echo "--issuer-uri=https://token.actions.githubusercontent.com") \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository == '${GITHUB_REPO}'" >/dev/null

PROVIDER_NAME="projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/providers/${PROVIDER}"

echo "▶ Sadece ${GITHUB_REPO} bu servis hesabını kullanabilir"
gcloud iam service-accounts add-iam-policy-binding "${SA}" --project="${GCP_PROJECT}" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/${POOL}/attribute.repository/${GITHUB_REPO}" \
  --quiet >/dev/null

if command -v gh >/dev/null 2>&1; then
  echo "▶ GitHub Actions değişkenleri (${GITHUB_REPO})"
  gh variable set GCP_PROJECT --repo "${GITHUB_REPO}" --body "${GCP_PROJECT}"
  gh variable set GCP_REGION --repo "${GITHUB_REPO}" --body "${REGION}"
  gh variable set CLOUD_RUN_SERVICE --repo "${GITHUB_REPO}" --body "${SERVICE}"
  gh variable set GCP_WIF_PROVIDER --repo "${GITHUB_REPO}" --body "${PROVIDER_NAME}"
  gh variable set GCP_SERVICE_ACCOUNT --repo "${GITHUB_REPO}" --body "${SA}"
else
  cat <<EOF
gh bulunamadı; GitHub → Settings → Secrets and variables → Actions → Variables:
  GCP_PROJECT         = ${GCP_PROJECT}
  GCP_REGION          = ${REGION}
  CLOUD_RUN_SERVICE   = ${SERVICE}
  GCP_WIF_PROVIDER    = ${PROVIDER_NAME}
  GCP_SERVICE_ACCOUNT = ${SA}
EOF
fi

echo
echo "✔ Hazır. İsteğe bağlı: gh secret set ORIGIN_AUTH_SECRET --repo ${GITHUB_REPO}  (Cloudflare origin koruması)"
echo "  Her main push'u Cloud Run'a dağıtır: .github/workflows/deploy.yml"
