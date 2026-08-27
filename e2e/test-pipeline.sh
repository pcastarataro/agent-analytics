#!/usr/bin/env bash
set -euo pipefail

COMPOSE_DIR="$(cd "$(dirname "$0")/../docker" && pwd)"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API_URL="http://localhost:4000"
DASHBOARD_URL="http://localhost:5173"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1 — $2"; FAIL=$((FAIL + 1)); }

cleanup() {
  echo ""
  echo "Tearing down containers..."
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" down -v 2>/dev/null || true
}
trap cleanup EXIT

echo "=== Starting services ==="
docker compose -f "$COMPOSE_DIR/docker-compose.yml" up -d --build

echo ""
echo "=== Waiting for API health ==="
RETRIES=30
until curl -sf "$API_URL/health" > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "FATAL: API did not become healthy in time"
    docker compose -f "$COMPOSE_DIR/docker-compose.yml" logs api
    exit 1
  fi
  sleep 2
done
pass "API is healthy"

echo ""
echo "=== Waiting for Dashboard ==="
RETRIES=20
until curl -sf "$DASHBOARD_URL" > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "FATAL: Dashboard did not become available in time"
    docker compose -f "$COMPOSE_DIR/docker-compose.yml" logs dashboard
    exit 1
  fi
  sleep 2
done
pass "Dashboard is available"

echo ""
echo "=== Step 1: POST /v1/events/batch ==="
HTTP_CODE=$(curl -s -o /tmp/e2e-batch-resp.json -w "%{http_code}" \
  -X POST "$API_URL/v1/events/batch" \
  -H "Content-Type: application/json" \
  -d @"$REPO_ROOT/e2e/test-events.json")

if [ "$HTTP_CODE" = "201" ]; then
  ACCEPTED=$(cat /tmp/e2e-batch-resp.json | grep -o '"accepted":[0-9]*' | cut -d: -f2)
  if [ "$ACCEPTED" = "3" ]; then
    pass "Batch accepted 3 events (HTTP $HTTP_CODE)"
  else
    fail "Batch accepted count" "expected 3, got $ACCEPTED"
  fi
else
  fail "POST /v1/events/batch" "HTTP $HTTP_CODE — $(cat /tmp/e2e-batch-resp.json)"
fi

echo ""
echo "=== Step 2: GET /v1/events ==="
HTTP_CODE=$(curl -s -o /tmp/e2e-events-resp.json -w "%{http_code}" \
  "$API_URL/v1/events?limit=10")

if [ "$HTTP_CODE" = "200" ]; then
  EVENT_COUNT=$(cat /tmp/e2e-events-resp.json | python3 -c "import sys,json; print(len(json.load(sys.stdin)['data']))")
  if [ "$EVENT_COUNT" = "3" ]; then
    pass "GET /v1/events returned 3 events"
  else
    fail "GET /v1/events count" "expected 3, got $EVENT_COUNT"
  fi
else
  fail "GET /v1/events" "HTTP $HTTP_CODE — $(cat /tmp/e2e-events-resp.json)"
fi

echo ""
echo "=== Step 3: GET /v1/stats/overview ==="
HTTP_CODE=$(curl -s -o /tmp/e2e-stats-resp.json -w "%{http_code}" \
  "$API_URL/v1/stats/overview")

if [ "$HTTP_CODE" = "200" ]; then
  TOTAL=$(cat /tmp/e2e-stats-resp.json | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
  if [ "$TOTAL" = "3" ]; then
    pass "GET /v1/stats/overview total=3"
  else
    fail "GET /v1/stats/overview total" "expected 3, got $TOTAL"
  fi
else
  fail "GET /v1/stats/overview" "HTTP $HTTP_CODE — $(cat /tmp/e2e-stats-resp.json)"
fi

echo ""
echo "=== Step 4: Dashboard serves React app ==="
HTTP_CODE=$(curl -s -o /tmp/e2e-dashboard-resp.json -w "%{http_code}" \
  "$DASHBOARD_URL")

if [ "$HTTP_CODE" = "200" ]; then
  HAS_ROOT=$(cat /tmp/e2e-dashboard-resp.json | grep -c 'id="root"' || true)
  HAS_JS=$(cat /tmp/e2e-dashboard-resp.json | grep -c '.js' || true)
  if [ "$HAS_ROOT" -ge 1 ] && [ "$HAS_JS" -ge 1 ]; then
    pass "Dashboard serves HTML with React root + JS bundle"
  else
    fail "Dashboard HTML content" "missing root div or JS references"
  fi
else
  fail "Dashboard homepage" "HTTP $HTTP_CODE"
fi

echo ""
echo "=== Step 5: Dashboard proxies API through nginx ==="
HTTP_CODE=$(curl -s -o /tmp/e2e-proxy-resp.json -w "%{http_code}" \
  "$DASHBOARD_URL/v1/stats/overview")

if [ "$HTTP_CODE" = "200" ]; then
  TOTAL=$(cat /tmp/e2e-proxy-resp.json | python3 -c "import sys,json; print(json.load(sys.stdin)['total'])")
  if [ "$TOTAL" = "3" ]; then
    pass "Dashboard nginx proxy → API returns total=3"
  else
    fail "Dashboard proxy total" "expected 3, got $TOTAL"
  fi
else
  fail "Dashboard proxy /v1/stats/overview" "HTTP $HTTP_CODE"
fi

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
