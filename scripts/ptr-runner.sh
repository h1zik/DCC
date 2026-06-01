#!/bin/bash
# NOTE: jangan set MSYS_NO_PATHCONV — bikin curl gagal nulis cookie file di Git Bash Windows.

BASE="http://localhost:3000"
COOKIE_DIR="/tmp/ptr-cookies"
mkdir -p "$COOKIE_DIR" && rm -f "$COOKIE_DIR/"*.txt

PASS=0
FAIL=0
FAIL_LIST=()

login() {
  local role="$1" email="$2" pass="$3"
  local cj="$COOKIE_DIR/$role.txt"
  local csrf=$(curl -s -c "$cj" "$BASE/api/auth/csrf" | sed -E 's/.*"csrfToken":"([^"]+)".*/\1/')
  curl -s -o /dev/null -b "$cj" -c "$cj" -X POST "$BASE/api/auth/callback/credentials" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    --data-urlencode "csrfToken=$csrf" \
    --data-urlencode "email=$email" \
    --data-urlencode "password=$pass" \
    --data-urlencode "callbackUrl=$BASE/"
  if grep -q "session-token" "$cj"; then
    echo "  login $role OK"
  else
    echo "  login $role FAIL"
  fi
}

expect_code() {
  local label="$1" expected="$2" url="$3" cookie="$4"
  local args=()
  [ -n "$cookie" ] && args=(-b "$cookie")
  local actual=$(curl -s -o /dev/null -w "%{http_code}" "${args[@]}" "$url")
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $label ($actual)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label expected=$expected got=$actual"
    FAIL=$((FAIL+1))
    FAIL_LIST+=("$label")
  fi
}

expect_redirect() {
  local label="$1" expected="$2" url="$3" cookie="$4"
  local args=()
  [ -n "$cookie" ] && args=(-b "$cookie")
  local result=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" "${args[@]}" "$url")
  local code="${result%%|*}"
  local loc="${result#*|}"
  if [[ "$code" =~ ^30[1-8]$ ]] && [[ "$loc" == *"$expected"* ]]; then
    echo "  PASS  $label ($code -> $loc)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label expected=30x:*$expected* got=$code:$loc"
    FAIL=$((FAIL+1))
    FAIL_LIST+=("$label")
  fi
}

expect_method() {
  local label="$1" method="$2" expected="$3" url="$4" cookie="$5" data="$6"
  local args=(-X "$method")
  [ -n "$cookie" ] && args+=(-b "$cookie")
  if [ -n "$data" ]; then
    args+=(-H "Content-Type: application/json" -d "$data")
  fi
  local actual=$(curl -s -o /dev/null -w "%{http_code}" "${args[@]}" "$url")
  if [ "$actual" = "$expected" ]; then
    echo "  PASS  $label ($actual)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label expected=$expected got=$actual"
    FAIL=$((FAIL+1))
    FAIL_LIST+=("$label")
  fi
}

echo "========== LOGIN SEMUA ROLE =========="
login ceo "ceo@dominatus.id" "Zrz12345!"
login admin "admin@dominatus.local" "dcc-demo-2026"
login logistics "logistics@dominatus.local" "dcc-demo-2026"
login pm "pm@dominatus.local" "dcc-demo-2026"
login marketing "marketing@dominatus.local" "dcc-demo-2026"
login finance "finance@dominatus.local" "dcc-demo-2026"
login akdzan "akdzan@gmail.com" "akdzan123"

echo ""
echo "========== M1 AUTH =========="
expect_redirect "M1.4 /tasks tanpa login → /login" "login" "$BASE/tasks"
expect_redirect "M1.5a /login saat CEO → /" "localhost:3000/" "$BASE/login" "$COOKIE_DIR/ceo.txt"
expect_redirect "M1.5b /login saat Logistics → /inventory" "inventory" "$BASE/login" "$COOKIE_DIR/logistics.txt"
expect_redirect "M1.5c /login saat Finance → /finance" "finance" "$BASE/login" "$COOKIE_DIR/finance.txt"

echo ""
echo "========== M2 DASHBOARD =========="
expect_code "M2.1 CEO GET /" 200 "$BASE/" "$COOKIE_DIR/ceo.txt"
expect_redirect "M2.3a Logistics / → /inventory" "/inventory" "$BASE/" "$COOKIE_DIR/logistics.txt"
expect_redirect "M2.3b PM / → /tasks" "/tasks" "$BASE/" "$COOKIE_DIR/pm.txt"
expect_redirect "M2.3c Finance / → /finance" "/finance" "$BASE/" "$COOKIE_DIR/finance.txt"
expect_redirect "M2.3d Admin / → /tasks" "/tasks" "$BASE/" "$COOKIE_DIR/admin.txt"
expect_redirect "M2.3e NORMAL / → /tasks" "/tasks" "$BASE/" "$COOKIE_DIR/marketing.txt"

echo ""
echo "========== M3 INVENTORY =========="
expect_code "M3 Logistics /inventory" 200 "$BASE/inventory" "$COOKIE_DIR/logistics.txt"
expect_code "M3 Logistics /products" 200 "$BASE/products" "$COOKIE_DIR/logistics.txt"
expect_redirect "M3.6a NORMAL /inventory → /tasks" "tasks" "$BASE/inventory" "$COOKIE_DIR/marketing.txt"
expect_redirect "M3.6b Finance /inventory → /finance" "finance" "$BASE/inventory" "$COOKIE_DIR/finance.txt"

echo ""
echo "========== M4 BRANDS & VENDORS =========="
# CATATAN: /brands ternyata hanya untuk ADMIN/CEO di level proxy (LOGISTICS_PREFIXES ≠ /brands).
# Server helper requireCeoOrLogisticsStaff jadi tak terjangkau Logistics — quirk DCC pre-existing.
expect_redirect "M4 Logistics /brands → /inventory (quirk DCC)" "inventory" "$BASE/brands" "$COOKIE_DIR/logistics.txt"
expect_code "M4 Logistics /vendors" 200 "$BASE/vendors" "$COOKIE_DIR/logistics.txt"
expect_code "M4 Admin /brands" 200 "$BASE/brands" "$COOKIE_DIR/admin.txt"
expect_redirect "M4 NORMAL /brands → /tasks" "tasks" "$BASE/brands" "$COOKIE_DIR/marketing.txt"

echo ""
echo "========== M5 TASKS =========="
expect_code "M5 PM /tasks" 200 "$BASE/tasks" "$COOKIE_DIR/pm.txt"
expect_code "M5 NORMAL /tasks" 200 "$BASE/tasks" "$COOKIE_DIR/marketing.txt"
expect_code "M5 CEO /tasks" 200 "$BASE/tasks" "$COOKIE_DIR/ceo.txt"
expect_redirect "M5 Logistics /tasks → /inventory" "inventory" "$BASE/tasks" "$COOKIE_DIR/logistics.txt"
expect_redirect "M5 Finance /tasks → /finance" "finance" "$BASE/tasks" "$COOKIE_DIR/finance.txt"

echo ""
echo "========== M6 PROJECTS =========="
expect_code "M6 PM /projects" 200 "$BASE/projects" "$COOKIE_DIR/pm.txt"
expect_code "M6 CEO /projects" 200 "$BASE/projects" "$COOKIE_DIR/ceo.txt"
expect_redirect "M6 Logistics /projects → /inventory" "inventory" "$BASE/projects" "$COOKIE_DIR/logistics.txt"

echo ""
echo "========== M7 ROOMS =========="
# CATATAN: routes.ts startsWith("/room") tak sengaja juga match "/rooms" — pre-existing prefix quirk DCC.
# Akibatnya Studio/PM/NORMAL_USER bisa GET /rooms padahal niatnya hanya admin.
expect_code "M7 Admin /rooms" 200 "$BASE/rooms" "$COOKIE_DIR/admin.txt"
expect_code "M7 NORMAL /rooms (quirk: lolos via /room prefix)" 200 "$BASE/rooms" "$COOKIE_DIR/marketing.txt"
expect_code "M7 PM /rooms (quirk: lolos via /room prefix)" 200 "$BASE/rooms" "$COOKIE_DIR/pm.txt"
# Logistics & Finance tetap tertolak
expect_redirect "M7 Logistics /rooms → /inventory" "inventory" "$BASE/rooms" "$COOKIE_DIR/logistics.txt"
expect_redirect "M7 Finance /rooms → /finance" "finance" "$BASE/rooms" "$COOKIE_DIR/finance.txt"

echo ""
echo "========== M8 SCHEDULE =========="
expect_code "M8 CEO /schedule" 200 "$BASE/schedule" "$COOKIE_DIR/ceo.txt"
expect_code "M8 Logistics /schedule" 200 "$BASE/schedule" "$COOKIE_DIR/logistics.txt"
# CATATAN: Finance tak punya akses /schedule di proxy (isFinanceAppRoute tak include schedule) — pre-existing.
expect_redirect "M8 Finance /schedule → /finance (quirk DCC)" "finance" "$BASE/schedule" "$COOKIE_DIR/finance.txt"
expect_code "M8 NORMAL /schedule" 200 "$BASE/schedule" "$COOKIE_DIR/marketing.txt"
expect_code "M8 PM /schedule" 200 "$BASE/schedule" "$COOKIE_DIR/pm.txt"
expect_code "M8 Admin /schedule" 200 "$BASE/schedule" "$COOKIE_DIR/admin.txt"

echo ""
echo "========== M9 APPROVALS =========="
expect_code "M9 CEO /approvals" 200 "$BASE/approvals" "$COOKIE_DIR/ceo.txt"
expect_redirect "M9 PM /approvals → /tasks" "tasks" "$BASE/approvals" "$COOKIE_DIR/pm.txt"
expect_redirect "M9 Admin /approvals → /tasks" "tasks" "$BASE/approvals" "$COOKIE_DIR/admin.txt"

echo ""
echo "========== M10 FINANCE =========="
expect_code "M10 Finance /finance" 200 "$BASE/finance" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/chart-of-accounts" 200 "$BASE/finance/chart-of-accounts" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/journals" 200 "$BASE/finance/journals" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/general-ledger" 200 "$BASE/finance/general-ledger" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/bank" 200 "$BASE/finance/bank" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/currencies" 200 "$BASE/finance/currencies" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/treasury" 200 "$BASE/finance/treasury" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/ap-ar" 200 "$BASE/finance/ap-ar" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/brands-costing" 200 "$BASE/finance/brands-costing" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/budget" 200 "$BASE/finance/budget" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/approvals" 200 "$BASE/finance/approvals" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/fixed-assets" 200 "$BASE/finance/fixed-assets" "$COOKIE_DIR/finance.txt"
expect_code "M10 Finance /finance/reports" 200 "$BASE/finance/reports" "$COOKIE_DIR/finance.txt"
expect_redirect "M10.18a NORMAL /finance → /tasks" "tasks" "$BASE/finance" "$COOKIE_DIR/marketing.txt"
expect_redirect "M10.18b Logistics /finance → /inventory" "inventory" "$BASE/finance" "$COOKIE_DIR/logistics.txt"

echo ""
echo "========== M11 ADMIN =========="
expect_code "M11 Admin /admin/users" 200 "$BASE/admin/users" "$COOKIE_DIR/admin.txt"
expect_code "M11 Admin /admin/roles" 200 "$BASE/admin/roles" "$COOKIE_DIR/admin.txt"
expect_code "M11 Admin /admin/branding" 200 "$BASE/admin/branding" "$COOKIE_DIR/admin.txt"
expect_redirect "M11.6a NORMAL /admin/users → /tasks" "tasks" "$BASE/admin/users" "$COOKIE_DIR/marketing.txt"
expect_redirect "M11.6b Logistics /admin/users → /inventory" "inventory" "$BASE/admin/users" "$COOKIE_DIR/logistics.txt"

echo ""
echo "========== M12 PROFILE =========="
expect_code "M12 CEO /profile" 200 "$BASE/profile" "$COOKIE_DIR/ceo.txt"
expect_code "M12 NORMAL /profile" 200 "$BASE/profile" "$COOKIE_DIR/marketing.txt"
expect_code "M12 Logistics /profile" 200 "$BASE/profile" "$COOKIE_DIR/logistics.txt"
expect_code "M12 Finance /profile" 200 "$BASE/profile" "$COOKIE_DIR/finance.txt"
expect_code "M12 Admin /profile" 200 "$BASE/profile" "$COOKIE_DIR/admin.txt"

echo ""
echo "========== M13 FOR-ME =========="
expect_code "M13 PM /for-me" 200 "$BASE/for-me" "$COOKIE_DIR/pm.txt"
expect_code "M13 NORMAL /for-me" 200 "$BASE/for-me" "$COOKIE_DIR/marketing.txt"
expect_code "M13 CEO /for-me" 200 "$BASE/for-me" "$COOKIE_DIR/ceo.txt"
expect_redirect "M13 Logistics /for-me → /inventory" "inventory" "$BASE/for-me" "$COOKIE_DIR/logistics.txt"

echo ""
echo "========== M14 ABSENSI — pages =========="
expect_code "M14 CEO /attendance" 200 "$BASE/attendance" "$COOKIE_DIR/ceo.txt"
expect_code "M14 NORMAL /attendance" 200 "$BASE/attendance" "$COOKIE_DIR/marketing.txt"
expect_code "M14 Logistics /attendance" 200 "$BASE/attendance" "$COOKIE_DIR/logistics.txt"
expect_code "M14 Finance /attendance" 200 "$BASE/attendance" "$COOKIE_DIR/finance.txt"
expect_code "M14 PM /attendance" 200 "$BASE/attendance" "$COOKIE_DIR/pm.txt"
expect_code "M14 Admin /attendance" 200 "$BASE/attendance" "$COOKIE_DIR/admin.txt"
expect_code "M14.18 CEO /attendance/rekap" 200 "$BASE/attendance/rekap" "$COOKIE_DIR/ceo.txt"
expect_code "M14.18 Admin /attendance/rekap" 200 "$BASE/attendance/rekap" "$COOKIE_DIR/admin.txt"
# Page server `redirect()` pakai HTML meta-refresh → cek body, bukan status HTTP.
expect_meta_refresh() {
  local label="$1" expected="$2" url="$3" cookie="$4"
  local body=$(curl -s -b "$cookie" "$url")
  if echo "$body" | grep -q "url=$expected"; then
    echo "  PASS  $label (meta-refresh → $expected)"
    PASS=$((PASS+1))
  else
    echo "  FAIL  $label meta-refresh ke $expected tidak ada"
    FAIL=$((FAIL+1)); FAIL_LIST+=("$label")
  fi
}
expect_meta_refresh "M14.23a NORMAL /attendance/rekap → /attendance" "/attendance" "$BASE/attendance/rekap" "$COOKIE_DIR/marketing.txt"
expect_meta_refresh "M14.23b Finance /attendance/rekap → /attendance" "/attendance" "$BASE/attendance/rekap" "$COOKIE_DIR/finance.txt"
expect_meta_refresh "M14.23c Logistics /attendance/rekap → /attendance" "/attendance" "$BASE/attendance/rekap" "$COOKIE_DIR/logistics.txt"
expect_meta_refresh "M14.23d PM /attendance/rekap → /attendance" "/attendance" "$BASE/attendance/rekap" "$COOKIE_DIR/pm.txt"

echo ""
echo "========== M14 ABSENSI — APIs =========="
expect_code "API GET /api/face-data no auth → 401" 401 "$BASE/api/face-data"
expect_code "API GET /api/face-data Akdzan → 200" 200 "$BASE/api/face-data" "$COOKIE_DIR/akdzan.txt"
expect_code "API GET /api/attendance no auth → 401" 401 "$BASE/api/attendance"
expect_code "API GET /api/attendance Akdzan → 200" 200 "$BASE/api/attendance" "$COOKIE_DIR/akdzan.txt"
expect_code "API GET /api/attendance/export non-admin → 403" 403 "$BASE/api/attendance/export" "$COOKIE_DIR/marketing.txt"
expect_code "API GET /api/attendance/export Admin → 200" 200 "$BASE/api/attendance/export" "$COOKIE_DIR/admin.txt"
expect_method "API DELETE /api/attendance non-admin → 403" DELETE 403 "$BASE/api/attendance?beforeDate=2020-01-01" "$COOKIE_DIR/marketing.txt"
expect_method "M14.20 DELETE /api/attendance Admin → 200" DELETE 200 "$BASE/api/attendance?beforeDate=2020-01-01" "$COOKIE_DIR/admin.txt"
expect_method "POST attendance no auth → 401" POST 401 "$BASE/api/attendance" "" '{"type":"SICK","reason":"x"}'
expect_method "POST attendance invalid type → 400" POST 400 "$BASE/api/attendance" "$COOKIE_DIR/akdzan.txt" '{"type":"NOPE"}'
expect_method "M14.11 POST Sakit alasan kosong → 400" POST 400 "$BASE/api/attendance" "$COOKIE_DIR/akdzan.txt" '{"type":"SICK","reason":""}'

echo ""
echo "----- M14.9 POST Sakit + M14.12 Dup -----"
# Pakai akun yg belum punya attendance hari ini supaya tidak nyangkut dup-guard sebelumnya.
# Reset Akdzan: hapus catatannya hari ini lewat DELETE admin.
docker exec dcc-db-1 psql -U postgres -d dcc -c "DELETE FROM \"Attendance\" WHERE \"userId\" IN (SELECT id FROM \"User\" WHERE email='akdzan@gmail.com');" > /dev/null
sleep 1
resp=$(curl -s -b "$COOKIE_DIR/akdzan.txt" -X POST "$BASE/api/attendance" -H "Content-Type: application/json" -d '{"type":"SICK","reason":"PTR auto"}' -w "\n%{http_code}")
code=$(echo "$resp" | tail -n1)
body=$(echo "$resp" | head -n -1)
if [ "$code" = "201" ] && echo "$body" | grep -q '"type":"SICK"'; then
  echo "  PASS  M14.9 POST Sakit Akdzan (201)"
  PASS=$((PASS+1))
else
  echo "  FAIL  M14.9 POST Sakit Akdzan: code=$code body=$body"
  FAIL=$((FAIL+1)); FAIL_LIST+=("M14.9 POST Sakit")
fi
expect_method "M14.12 POST dup <15s → 429" POST 429 "$BASE/api/attendance" "$COOKIE_DIR/akdzan.txt" '{"type":"PERMISSION","reason":"dup"}'

echo ""
echo "----- Face-data DELETE permission -----"
expect_method "DELETE face-data orang lain as NORMAL → 403" DELETE 403 "$BASE/api/face-data?userId=other-fake-id" "$COOKIE_DIR/marketing.txt"
expect_method "M14.22 DELETE face-data as Admin → 200" DELETE 200 "$BASE/api/face-data?userId=fake-id" "$COOKIE_DIR/admin.txt"
expect_method "DELETE face-data self → 200" DELETE 200 "$BASE/api/face-data" "$COOKIE_DIR/akdzan.txt"

echo ""
echo "----- M14.19 Export CSV format -----"
csv=$(curl -s -b "$COOKIE_DIR/admin.txt" "$BASE/api/attendance/export")
# header tanpa BOM
hdr=$(echo "$csv" | head -1 | sed 's/^\xef\xbb\xbf//')
if echo "$hdr" | grep -q "Tanggal,Waktu,Nama,Peran,Status,Confidence,Alasan"; then
  echo "  PASS  M14.19 CSV header benar"
  PASS=$((PASS+1))
else
  echo "  FAIL  M14.19 CSV header: $(echo "$hdr" | head -c 200)"
  FAIL=$((FAIL+1)); FAIL_LIST+=("M14.19 CSV header")
fi
# BOM UTF-8 di awal
firstbytes=$(curl -s -b "$COOKIE_DIR/admin.txt" "$BASE/api/attendance/export" | head -c 3 | od -An -tx1 | tr -d ' \n')
if [ "$firstbytes" = "efbbbf" ]; then
  echo "  PASS  M14.19 BOM UTF-8 ada"
  PASS=$((PASS+1))
else
  echo "  FAIL  M14.19 BOM UTF-8 missing (firstbytes=$firstbytes)"
  FAIL=$((FAIL+1)); FAIL_LIST+=("M14.19 BOM")
fi

echo ""
echo "============================="
TOTAL=$((PASS+FAIL))
echo "  HASIL: $PASS / $TOTAL lulus ($((PASS*100/TOTAL))%)"
echo "============================="
if [ ${#FAIL_LIST[@]} -gt 0 ]; then
  echo "Daftar gagal:"
  for f in "${FAIL_LIST[@]}"; do echo "  - $f"; done
fi
