#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Map a domain (+ www) to the Cloud Run service and print the DNS records
# you must create at the DNS provider (registrar, or Cloudflare after the NS switch).
#
#   export GCP_PROJECT=my-project
#   DOMAIN=example.com ./deploy/domain-mapping.sh
#
# Prerequisite: the domain must be verified for this Google account:
#   gcloud domains verify example.com   (opens Search Console → TXT record at DNS)
# ---------------------------------------------------------------------------
set -euo pipefail

: "${GCP_PROJECT:?GCP_PROJECT ayarlanmalı}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE="${SERVICE:-youreyesinthespace}"
: "${DOMAIN:?DOMAIN ayarlanmalı (örn. example.com)}"

echo "▶ Alan adı doğrulaması kontrol ediliyor"
if ! gcloud domains list-user-verified --project="${GCP_PROJECT}" --format='value(id)' | grep -qx "${DOMAIN}"; then
  echo "✖ ${DOMAIN} bu Google hesabı için doğrulanmamış."
  echo "  Çalıştır:  gcloud domains verify ${DOMAIN}"
  echo "  Açılan Search Console sayfasındaki TXT kaydını DNS sağlayıcına ekle, doğrula, sonra bu scripti tekrar çalıştır."
  exit 1
fi

for host in "${DOMAIN}" "www.${DOMAIN}"; do
  echo "▶ Domain mapping: ${host} → ${SERVICE}"
  if gcloud beta run domain-mappings describe --domain="${host}" --region="${REGION}" --project="${GCP_PROJECT}" >/dev/null 2>&1; then
    echo "  · zaten var"
  else
    gcloud beta run domain-mappings create --service="${SERVICE}" --domain="${host}" \
      --region="${REGION}" --project="${GCP_PROJECT}" --quiet
  fi
done

echo
echo "▶ DNS'e eklenecek kayıtlar"
for host in "${DOMAIN}" "www.${DOMAIN}"; do
  echo "  [${host}]"
  gcloud beta run domain-mappings describe --domain="${host}" --region="${REGION}" --project="${GCP_PROJECT}" \
    --format='table[no-heading](status.resourceRecords[].type, status.resourceRecords[].name, status.resourceRecords[].rrdata)' \
    | sed 's/^/    /'
done

cat <<EOF

Notlar
  • Kök alan adı (${DOMAIN}) için Google 4 A + 4 AAAA kaydı verir; www için CNAME ghs.googlehosted.com.
  • Sertifika Google tarafından otomatik çıkarılır (5–30 dk). Durum:
      gcloud beta run domain-mappings describe --domain=${DOMAIN} --region=${REGION} --format='value(status.conditions)'
  • Cloudflare kullanıyorsan: sertifika "Ready" olana kadar kayıtlar DNS-only (gri bulut) kalsın,
    sonra Proxied (turuncu) yap ve deploy/cloudflare-security.sh çalıştır (SSL mode: Full strict).
EOF
