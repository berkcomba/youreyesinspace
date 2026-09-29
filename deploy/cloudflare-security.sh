#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Cloudflare production hardening for youreyesinthespace (in front of Cloud Run).
# Idempotent: safe to re-run. Uses only the Cloudflare v4 API.
#
# Required env:
#   CF_API_TOKEN        API token with Zone:Zone Settings:Edit, Zone:Firewall Services:Edit,
#                       Zone:Cache Rules:Edit, Zone:Transform Rules:Edit, Zone:Bot Management:Edit
#   CF_ZONE_ID          zone id of the domain
#   SITE_HOST           e.g. example.com
#   ORIGIN_AUTH_SECRET  same value passed to Cloud Run (X-Origin-Auth header) – optional
#
# Never commit these values; export them in the shell or use a secret manager.
# ---------------------------------------------------------------------------
set -euo pipefail

: "${CF_API_TOKEN:?CF_API_TOKEN ayarlanmalı}"
: "${CF_ZONE_ID:?CF_ZONE_ID ayarlanmalı}"
: "${SITE_HOST:?SITE_HOST ayarlanmalı (ör. example.com)}"

API="https://api.cloudflare.com/client/v4"
AUTH=(-H "Authorization: Bearer ${CF_API_TOKEN}" -H "Content-Type: application/json")

cf() { # method path [json]
  local method="$1" path="$2" body="${3:-}"
  if [[ -n "$body" ]]; then
    curl -sS -X "$method" "${API}${path}" "${AUTH[@]}" --data "$body"
  else
    curl -sS -X "$method" "${API}${path}" "${AUTH[@]}"
  fi
}

ok() { # pipe: fail loudly if success != true
  local resp; resp="$(cat)"
  if [[ "$(printf '%s' "$resp" | jq -r '.success')" != "true" ]]; then
    echo "✖ Cloudflare API hatası:" >&2
    printf '%s\n' "$resp" | jq '.errors' >&2
    exit 1
  fi
  printf '%s' "$resp"
}

setting() { # name value-json
  echo "  · $1 = $2"
  cf PATCH "/zones/${CF_ZONE_ID}/settings/$1" "{\"value\":$2}" | ok >/dev/null
}

echo "▶ TLS / HTTPS"
setting ssl '"strict"'                       # Full (strict): Cloud Run has a valid cert
setting always_use_https '"on"'
setting automatic_https_rewrites '"on"'
setting min_tls_version '"1.2"'
setting tls_1_3 '"on"'
setting opportunistic_encryption '"on"'
setting security_header '{"strict_transport_security":{"enabled":true,"max_age":31536000,"include_subdomains":true,"preload":true,"nosniff":true}}'

echo "▶ Performans"
setting brotli '"on"'
setting early_hints '"on"'
setting http3 '"on"'
setting zero_rtt '"on"'
setting minify '{"css":"on","html":"on","js":"off"}'   # JS zaten minified; Cloudflare minify modül scriptlerini bozmasın

echo "▶ Güvenlik seviyesi / bot"
setting security_level '"medium"'
setting browser_check '"on"'
setting challenge_ttl '1800'
setting privacy_pass '"on"'
# Bot Fight Mode (free plan) – Super Bot Fight Mode planlarda otomatik devreye girer
cf PUT "/zones/${CF_ZONE_ID}/bot_management" '{"fight_mode":true}' | ok >/dev/null || true

# ---------------------------------------------------------------------------
# Rulesets helper: create-or-update the zone entrypoint ruleset for a phase
# ---------------------------------------------------------------------------
put_phase() { # phase rules-json
  local phase="$1" rules="$2"
  echo "  · ruleset phase ${phase}"
  cf PUT "/zones/${CF_ZONE_ID}/rulesets/phases/${phase}/entrypoint" \
    "{\"name\":\"yeits ${phase}\",\"kind\":\"zone\",\"phase\":\"${phase}\",\"rules\":${rules}}" | ok >/dev/null
}

echo "▶ WAF özel kuralları (http_request_firewall_custom)"
put_phase http_request_firewall_custom "$(cat <<JSON
[
  {
    "description": "Sadece GET/HEAD/OPTIONS - statik site",
    "expression": "(http.host eq \"${SITE_HOST}\" and not http.request.method in {\"GET\" \"HEAD\" \"OPTIONS\"})",
    "action": "block",
    "enabled": true
  },
  {
    "description": "Gizli dosyalar, source map, .env, git",
    "expression": "(http.request.uri.path matches \"^/(\\\\.|.*\\\\.map$|.*\\\\.env|.*\\\\.git)\")",
    "action": "block",
    "enabled": true
  },
  {
    "description": "Yüksek tehdit skoru -> managed challenge",
    "expression": "(cf.threat_score gt 30)",
    "action": "managed_challenge",
    "enabled": true
  },
  {
    "description": "Doğrulanmamış otomatik bot -> managed challenge (index.html)",
    "expression": "(cf.client.bot and not cf.verified_bot_category in {\"Search Engine Crawler\" \"Monitoring & Analytics\"} and http.request.uri.path eq \"/\")",
    "action": "managed_challenge",
    "enabled": true
  }
]
JSON
)"

echo "▶ Rate limiting (http_ratelimit)"
# ~500 kullanıcı/gün için cömert ama flood'u kesen sınırlar (IP başına, 10 sn pencere)
put_phase http_ratelimit "$(cat <<JSON
[
  {
    "description": "HTML shell: IP basina 10 sn'de 60 istek",
    "expression": "(http.host eq \"${SITE_HOST}\" and http.request.uri.path in {\"/\" \"/index.html\"})",
    "action": "managed_challenge",
    "ratelimit": {"characteristics": ["ip.src","cf.colo.id"], "period": 10, "requests_per_period": 60, "mitigation_timeout": 60},
    "enabled": true
  },
  {
    "description": "Buyuk veri (stars.bin, modeller): IP basina 10 sn'de 120 istek",
    "expression": "(http.host eq \"${SITE_HOST}\" and starts_with(http.request.uri.path, \"/data/\") or starts_with(http.request.uri.path, \"/models/\"))",
    "action": "block",
    "ratelimit": {"characteristics": ["ip.src","cf.colo.id"], "period": 10, "requests_per_period": 120, "mitigation_timeout": 120},
    "enabled": true
  },
  {
    "description": "Genel: IP basina 10 sn'de 600 istek",
    "expression": "(http.host eq \"${SITE_HOST}\")",
    "action": "block",
    "ratelimit": {"characteristics": ["ip.src","cf.colo.id"], "period": 10, "requests_per_period": 600, "mitigation_timeout": 300},
    "enabled": true
  }
]
JSON
)"

echo "▶ Cache kuralları (http_request_cache_settings)"
put_phase http_request_cache_settings "$(cat <<JSON
[
  {
    "description": "Hashli asset + veri + modeller: edge'de 1 yil",
    "expression": "(http.host eq \"${SITE_HOST}\" and (starts_with(http.request.uri.path, \"/assets/\") or starts_with(http.request.uri.path, \"/data/\") or starts_with(http.request.uri.path, \"/models/\")))",
    "action": "set_cache_settings",
    "action_parameters": {
      "cache": true,
      "edge_ttl": {"mode": "override_origin", "default": 31536000},
      "browser_ttl": {"mode": "respect_origin"},
      "cache_key": {"custom_key": {"query_string": {"include": "*"}}},
      "serve_stale": {"disable_stale_while_updating": false}
    },
    "enabled": true
  },
  {
    "description": "HTML shell: edge'de 5 dk, origin'e saygi",
    "expression": "(http.host eq \"${SITE_HOST}\" and http.request.uri.path in {\"/\" \"/index.html\"})",
    "action": "set_cache_settings",
    "action_parameters": {
      "cache": true,
      "edge_ttl": {"mode": "override_origin", "default": 300},
      "browser_ttl": {"mode": "respect_origin"}
    },
    "enabled": true
  }
]
JSON
)"

if [[ -n "${ORIGIN_AUTH_SECRET:-}" ]]; then
  echo "▶ Origin koruması: X-Origin-Auth başlığı (http_request_late_transform)"
  put_phase http_request_late_transform "$(cat <<JSON
[
  {
    "description": "Cloud Run origin'e paylasilan sir",
    "expression": "(http.host eq \"${SITE_HOST}\")",
    "action": "rewrite",
    "action_parameters": {"headers": {"X-Origin-Auth": {"operation": "set", "value": "${ORIGIN_AUTH_SECRET}"}}},
    "enabled": true
  }
]
JSON
)"
else
  echo "⚠ ORIGIN_AUTH_SECRET verilmedi; origin koruma başlığı eklenmedi."
fi

echo "▶ Yanıt başlıkları (http_response_headers_transform) – origin'de zaten var, edge'de garanti"
put_phase http_response_headers_transform "$(cat <<JSON
[
  {
    "description": "Guvenlik basliklari",
    "expression": "(http.host eq \"${SITE_HOST}\")",
    "action": "rewrite",
    "action_parameters": {"headers": {
      "X-Content-Type-Options": {"operation": "set", "value": "nosniff"},
      "X-Frame-Options": {"operation": "set", "value": "DENY"},
      "Referrer-Policy": {"operation": "set", "value": "strict-origin-when-cross-origin"},
      "Permissions-Policy": {"operation": "set", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"},
      "Server": {"operation": "remove"},
      "X-Powered-By": {"operation": "remove"}
    }},
    "enabled": true
  }
]
JSON
)"

echo
echo "✔ Cloudflare yapılandırması tamamlandı: https://${SITE_HOST}"
echo "  Kontrol: curl -sI https://${SITE_HOST}/ | grep -iE 'strict-transport|content-security|cf-cache-status|cache-control'"
