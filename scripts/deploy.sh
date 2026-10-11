#!/usr/bin/env bash
# One-shot Vercel deploy. Reads secrets from .env and pipes them to Vercel (never printed).
set -euo pipefail
cd "$(dirname "$0")/.."
V="npx -y vercel@latest"
$V link --yes --project aangan-enquiry-agent >/dev/null
for key in DATABASE_URL GEMINI_API_KEY GEMINI_MODEL APP_SIGNING_SECRET CRON_SECRET VAANI_WEBHOOK_SECRET DASHBOARD_ACCESS_KEY; do
  val="$(grep -E "^${key}=" .env | head -1 | cut -d= -f2-)"
  [ -z "$val" ] && continue
  $V env rm "$key" production --yes >/dev/null 2>&1 || true
  printf '%s' "$val" | $V env add "$key" production >/dev/null
  echo "env set: $key"
done
URL="https://YOUR-APP.vercel.app"
$V env rm APP_BASE_URL production --yes >/dev/null 2>&1 || true
printf '%s' "$URL" | $V env add APP_BASE_URL production >/dev/null
$V deploy --prod --yes
echo
echo "Founder link: $URL/open/$(grep -E '^DASHBOARD_ACCESS_KEY=' .env | cut -d= -f2-)" > FOUNDER_LINK.txt
echo "Founder link written to FOUNDER_LINK.txt"
