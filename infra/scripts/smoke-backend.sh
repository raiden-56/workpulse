#!/usr/bin/env bash
# End-to-end smoke test: starts the Compose infrastructure, runs the packaged backend jar against it
# and exercises the main API flows with curl. Build the jar first: ./mvnw -DskipTests package
# Usage: bash infra/scripts/smoke-backend.sh
set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/infra" && docker compose up -d 2>&1 | tail -5
echo "--- waiting for infra health ---"
for i in $(seq 1 60); do
  if docker compose ps --format '{{.Name}} {{.Health}}' | grep -q unhealthy; then :; fi
  healthy=$(docker compose ps --format '{{.Health}}' | grep -c healthy)
  [ "$healthy" -ge 3 ] && break
  sleep 2
done
docker compose ps --format 'table {{.Name}}\t{{.Status}}'

cd "$ROOT/workpulse-backend"
JAR=$(ls target/workpulse-backend-*.jar | head -1)
echo "--- starting $JAR ---"
java -jar "$JAR" > /tmp/wp-backend.log 2>&1 &
PID=$!
for i in $(seq 1 120); do
  if curl -s -o /dev/null -w '%{http_code}' http://localhost:8080/actuator/health 2>/dev/null | grep -q -E "200|503"; then break; fi
  sleep 2
done
echo "--- health ---"; curl -s http://localhost:8080/actuator/health; echo
grep -E "Bootstrapped|Demo organisation seeded|Started WorkPulseApplication|ERROR" /tmp/wp-backend.log | head -10

H='Content-Type: application/json'
tok() { sed -E 's/.*"accessToken":"([^"]+)".*/\1/'; }

echo "--- super admin login ---"
ROOT_TOKEN=$(curl -s -H "$H" -d '{"email":"admin@workpulse.local","password":"ChangeMe!2026"}' http://localhost:8080/api/v1/auth/login | tok)
echo "token length: ${#ROOT_TOKEN}"
echo "--- organizations (super admin) ---"
curl -s -H "Authorization: Bearer $ROOT_TOKEN" http://localhost:8080/api/v1/organizations | head -c 400; echo

echo "--- guest config ---"
curl -s http://localhost:8080/api/v1/guest/config | head -c 300; echo
echo "--- guest session ---"
GUEST=$(curl -s -H "$H" -d '{"persona":"EXECUTIVE"}' http://localhost:8080/api/v1/guest/sessions)
echo "$GUEST" | head -c 200; echo
GTOKEN=$(echo "$GUEST" | tok)
echo "--- guest demo reset (regenerates data, keeps org id) ---"
curl -s -X POST -H "Authorization: Bearer $GTOKEN" http://localhost:8080/api/v1/guest/demo/reset | head -c 200; echo
echo "--- guest dashboard overview ---"
curl -s -H "Authorization: Bearer $GTOKEN" "http://localhost:8080/api/v1/dashboard/overview" | head -c 900; echo
echo "--- guest live (3) ---"
curl -s -H "Authorization: Bearer $GTOKEN" "http://localhost:8080/api/v1/activity/live?size=3" | head -c 700; echo
echo "--- guest employees (2) ---"
curl -s -H "Authorization: Bearer $GTOKEN" "http://localhost:8080/api/v1/employees?size=2" | head -c 500; echo
echo "--- guest write attempt (expect 403) ---"
curl -s -o /dev/null -w '%{http_code}\n' -H "$H" -H "Authorization: Bearer $GTOKEN" -d '{"name":"x"}' http://localhost:8080/api/v1/departments
echo "--- guest timeline for persona employee ---"
ETOKEN=$(curl -s -H "$H" -d '{"persona":"EMPLOYEE"}' http://localhost:8080/api/v1/guest/sessions | tok)
curl -s -H "Authorization: Bearer $ETOKEN" "http://localhost:8080/api/v1/activity/timeline" | head -c 700; echo

echo "--- demo admin login + devices summary + audit ---"
ATOKEN=$(curl -s -H "$H" -d '{"email":"demo.admin@workpulse.demo","password":"Demo!2026pass"}' http://localhost:8080/api/v1/auth/login | tok)
curl -s -H "Authorization: Bearer $ATOKEN" http://localhost:8080/api/v1/devices/summary; echo
curl -s -H "Authorization: Bearer $ATOKEN" "http://localhost:8080/api/v1/audit-logs?size=2" | head -c 400; echo
echo "--- team lead scoped overview ---"
LTOKEN=$(curl -s -H "$H" -d '{"email":"demo.lead@workpulse.demo","password":"Demo!2026pass"}' http://localhost:8080/api/v1/auth/login | tok)
curl -s -H "Authorization: Bearer $LTOKEN" http://localhost:8080/api/v1/dashboard/overview | grep -o '"scopeLevel":"[A-Z]*"\|"headcount":{[^}]*}'
echo "--- system health (super admin) ---"
curl -s -H "Authorization: Bearer $ROOT_TOKEN" http://localhost:8080/api/v1/system/health; echo
echo "--- openapi path count ---"
curl -s http://localhost:8080/v3/api-docs | grep -o '"/api/v1/[^"]*"' | sort -u | wc -l
curl -s -o /dev/null -w 'swagger-ui: %{http_code}\n' http://localhost:8080/swagger-ui/index.html

echo "--- stopping backend (pid $PID) ---"
kill $PID 2>/dev/null; sleep 3
tasklist 2>/dev/null | grep -i "java.exe" | head -3
echo "done"
