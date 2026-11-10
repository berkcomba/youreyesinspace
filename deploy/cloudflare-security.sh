#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# Cloudflare production hardening for youreyesinthespace (in front of Cloud Run).
# Idempotent: safe to re-run. Uses only the Cloudflare v4 API, bash and curl, and stays within
# what the Free plan allows (no regex in rules, one rate limiting rule of 10 s).
#
# Required env:
#   CF_API_TOKEN        API token with Zone:Zone Settings:Edit, Zone:Firewall Services:Edit,
#                       Zone:Cache Rules:Edit, Zone:Transform Rules:Edit, Zone:Bot Management:Edit
#   CF_ZONE_ID          zone id of the domain
#   SITE_HOST           e.g. example.com (www.<SITE_HOST> is covered too)
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
# the apex and www are both mapped to the service: every rule has to hold for the two of them
HOSTS='http.host in {\"'"${SITE_HOST}"'\" \"www.'"${SITE_HOST}"'\"}'

FAILED=()

# One API call. A failure is reported and remembered, not fatal: every step is independent, and
# a setting Cloudflare has retired or keeps for a higher plan must not leave the rest unapplied.
call() { # label method path [json] [secret]
  local label="$1" method="$2" path="$3" body="${4:-}" secret="${5:-}" resp
  local okre='"success":[[:space:]]*true'
  if [[ -n "$body" ]]; then
    # the body goes in on stdin: it may carry the origin secret, which must not show in `ps`
    resp="$(printf '%s' "$body" | curl -sS -X "$method" "${API}${path}" "${AUTH[@]}" --data @- 2>&1)" || true
  else
    resp="$(curl -sS -X "$method" "${API}${path}" "${AUTH[@]}" 2>&1)" || true
  fi
  if [[ "$resp" =~ $okre ]]; then return 0; fi
  FAILED+=("$label")
  if [[ -n "$secret" ]]; then
    echo "    ✖ ${label} (yanıt gösterilmiyor: sırrı içerebilir)" >&2
  else
    echo "    ✖ ${label}: ${resp:0:600}" >&2
  fi
}

setting() { # name value-json
  echo "  · $1 = $2"
  call "ayar $1" PATCH "/zones/${CF_ZONE_ID}/settings/$1" "{\"value\":$2}"
}

echo "▶ TLS / HTTPS"
setting ssl '"strict"'                       # Full (strict): Cloud Run has a valid cert
# Off on purpose. Cloud Run renews its certificate over http (/.well-known/acme-challenge/), and
# Cloudflare's redirect would swallow that request: the renewal fails and, with Full (strict),
# the site goes down when the certificate runs out. nginx redirects visitors instead (CF-Visitor).
# https://cloud.google.com/run/docs/mapping-custom-domains#dns_update
setting always_use_https '"off"'
setting automatic_https_rewrites '"on"'
setting min_tls_version '"1.2"'
setting tls_1_3 '"on"'
setting opportunistic_encryption '"on"'
setting security_header '{"strict_transport_security":{"enabled":true,"max_age":31536000,"include_subdomains":true,"preload":true,"nosniff":true}}'

echo "▶ Performans"
# (Brotli is always on and Auto Minify is gone: neither is a zone setting any more)
setting early_hints '"on"'
setting http3 '"on"'
setting 0rtt '"on"'

echo "▶ Güvenlik seviyesi / bot"
setting security_level '"medium"'
setting browser_check '"on"'
setting challenge_ttl '1800'
# Bot Fight Mode (free plan) – Super Bot Fight Mode planlarda otomatik devreye girer
echo "  · bot fight mode"
call "bot fight mode" PUT "/zones/${CF_ZONE_ID}/bot_management" '{"fight_mode":true}'

# ---------------------------------------------------------------------------
# Rulesets helper: create-or-update the zone entrypoint ruleset for a phase
# ---------------------------------------------------------------------------
put_phase() { # phase rules-json [secret]
  local phase="$1" rules="$2"
  echo "  · ruleset phase ${phase}"
  call "kurallar ${phase}" PUT "/zones/${CF_ZONE_ID}/rulesets/phases/${phase}/entrypoint" \
    "{\"name\":\"yeits ${phase}\",\"kind\":\"zone\",\"phase\":\"${phase}\",\"rules\":${rules}}" "${3:-}"
}

echo "▶ WAF özel kuralları (http_request_firewall_custom)"
# /.well-known/ stays open: the certificate renewal above goes through it.
# Verified bots are left alone: link previews (the cards of a shared ?target= link) are among them.
put_phase http_request_firewall_custom "$(cat <<JSON
[
  {
    "description": "Sadece GET/HEAD/OPTIONS - statik site",
    "expression": "(${HOSTS} and not http.request.method in {\"GET\" \"HEAD\" \"OPTIONS\"})",
    "action": "block",
    "enabled": true
  },
  {
    "description": "Gizli dosyalar, source map, .env, git",
    "expression": "((starts_with(http.request.uri.path, \"/.\") and not starts_with(http.request.uri.path, \"/.well-known/\")) or ends_with(http.request.uri.path, \".map\") or http.request.uri.path contains \".env\" or http.request.uri.path contains \"/.git\")",
    "action": "block",
    "enabled": true
  }
]
JSON
)"

echo "▶ Rate limiting (http_ratelimit)"
# One rule, 10 s window, 10 s block and a path-only expression: all the Free plan has. Requests
# answered from the edge cache count too, and a classroom shares one address, so the limit sits
# well above a room of page loads (~150 requests each) and only stops a flood.
put_phase http_ratelimit "$(cat <<JSON
[
  {
    "description": "Genel: IP basina 10 sn'de 2000 istek",
    "expression": "(starts_with(http.request.uri.path, \"/\"))",
    "action": "block",
    "ratelimit": {"characteristics": ["ip.src","cf.colo.id"], "period": 10, "requests_per_period": 2000, "mitigation_timeout": 10},
    "enabled": true
  }
]
JSON
)"

echo "▶ Cache kuralları (http_request_cache_settings)"
# The static folders are kept at the edge whatever their file type (Cloudflare would skip .json,
# .glb and .bin on its own); for how long is nginx's decision alone (deploy/nginx): a year for
# the hashed and ?v= URLs, a day for images, revalidate-every-time for the unversioned audio.
# HTML is not kept at the edge: a deploy shows at once.
put_phase http_request_cache_settings "$(cat <<JSON
[
  {
    "description": "Statik klasorler: edge'de tut, sureler origin'den",
    "expression": "(${HOSTS} and (starts_with(http.request.uri.path, \"/assets/\") or starts_with(http.request.uri.path, \"/data/\") or starts_with(http.request.uri.path, \"/models/\") or starts_with(http.request.uri.path, \"/maps/\") or starts_with(http.request.uri.path, \"/skins/\") or starts_with(http.request.uri.path, \"/ground/\") or starts_with(http.request.uri.path, \"/nebulae/\") or starts_with(http.request.uri.path, \"/tours/\") or starts_with(http.request.uri.path, \"/tour-media/\") or starts_with(http.request.uri.path, \"/lessons/\") or starts_with(http.request.uri.path, \"/music/\") or starts_with(http.request.uri.path, \"/expedition/\") or starts_with(http.request.uri.path, \"/scope/\") or starts_with(http.request.uri.path, \"/wiki/\") or starts_with(http.request.uri.path, \"/events/\") or starts_with(http.request.uri.path, \"/ephem/\")))",
    "action": "set_cache_settings",
    "action_parameters": {
      "cache": true,
      "edge_ttl": {"mode": "respect_origin"},
      "browser_ttl": {"mode": "respect_origin"}
    },
    "enabled": true
  },
  {
    "description": "Kullanim isaretcisi: cache yok (her istek origin loguna dusmeli)",
    "expression": "(${HOSTS} and http.request.uri.path eq \"/_b.gif\")",
    "action": "set_cache_settings",
    "action_parameters": {"cache": false},
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
    "expression": "(${HOSTS})",
    "action": "rewrite",
    "action_parameters": {"headers": {"X-Origin-Auth": {"operation": "set", "value": "${ORIGIN_AUTH_SECRET}"}}},
    "enabled": true
  }
]
JSON
)" secret
else
  echo "⚠ ORIGIN_AUTH_SECRET verilmedi; origin koruma başlığı eklenmedi."
fi

echo "▶ Yanıt başlıkları (http_response_headers_transform) – origin'de zaten var, edge'de garanti"
# X-Frame-Options yalnızca gömülebilir olay görünümü (?embed=1) dışında: Olaylar panelinin verdiği
# iframe kodu başka sitelerde çalışmalı; origin (nginx) aynı koşulla CSP frame-ancestors'ı da açar.
# (`Server` is Cloudflare's own and cannot be rewritten.)
put_phase http_response_headers_transform "$(cat <<JSON
[
  {
    "description": "Guvenlik basliklari",
    "expression": "(${HOSTS})",
    "action": "rewrite",
    "action_parameters": {"headers": {
      "X-Content-Type-Options": {"operation": "set", "value": "nosniff"},
      "Referrer-Policy": {"operation": "set", "value": "strict-origin-when-cross-origin"},
      "Permissions-Policy": {"operation": "set", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=()"},
      "X-Powered-By": {"operation": "remove"}
    }},
    "enabled": true
  },
  {
    "description": "Cerceve yasagi (embed disinda)",
    "expression": "(${HOSTS} and not http.request.uri.args[\"embed\"][0] eq \"1\")",
    "action": "rewrite",
    "action_parameters": {"headers": {
      "X-Frame-Options": {"operation": "set", "value": "DENY"}
    }},
    "enabled": true
  }
]
JSON
)"

echo
if (( ${#FAILED[@]} )); then
  echo "✖ ${#FAILED[@]} adım uygulanamadı (diğerleri uygulandı):" >&2
  printf '    - %s\n' "${FAILED[@]}" >&2
  exit 1
fi
echo "✔ Cloudflare yapılandırması tamamlandı: https://${SITE_HOST}"
echo "  Kontrol: curl -sI https://${SITE_HOST}/ | grep -iE 'strict-transport|content-security|cf-cache-status|cache-control'"
