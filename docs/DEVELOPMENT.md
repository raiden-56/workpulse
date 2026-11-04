# WorkPulse – Development Guide

## Prerequisites

| Tool | Version | Used by |
|---|---|---|
| Docker Desktop (with Compose v2) | 24+ | Local PostgreSQL, Redis, RabbitMQ; integration tests (Testcontainers) |
| Java (Temurin / Microsoft OpenJDK) | 17 | Backend (`./mvnw` downloads Maven itself) |
| Node.js | 20+ (24 recommended) | Web portal, Electron agent |
| .NET SDK | 8.0 | Agent service and collector (Windows only) |
| Windows 10/11 | – | Running the desktop agent |

## 1. Infrastructure

```bash
cd infra
cp .env.example .env            # adjust secrets if you like
docker compose up -d            # postgres on host port 55432, redis:6379, rabbitmq:5672 (+ management UI :15672)
```

PostgreSQL is published on **55432** (not 5432) so that a PostgreSQL server installed directly on the
workstation, or another project's database container, does not shadow it. Override with
`POSTGRES_PORT` in `.env` and `WORKPULSE_DB_URL` for the backend if you prefer another port.

## 2. Backend

```bash
cd workpulse-backend
./mvnw spring-boot:run           # http://localhost:8080  –  Swagger UI: /swagger-ui.html
```

On first start the backend:

* runs the Flyway migrations (`src/main/resources/db/migration`),
* creates the platform super admin from `workpulse.bootstrap.*`
  (default `admin@workpulse.local` / `ChangeMe!2026` – change it),
* seeds the **demo organisation** (because `workpulse.demo.enabled=true` by default) with
  simulated employees, devices and 14 days of activity, plus one portal user per role
  (`demo.admin@workpulse.demo`, `demo.it@…`, `demo.hr@…`, `demo.manager@…`, `demo.lead@…`,
  `demo.employee@…`, `demo.auditor@…`, password `Demo!2026pass`).

Configuration is environment driven; see `application.yml` (`WORKPULSE_*` variables).

Tests:

```bash
./mvnw test        # unit tests
./mvnw verify      # + integration tests (starts PostgreSQL/Redis/RabbitMQ containers via Testcontainers)
bash ../infra/scripts/smoke-backend.sh   # end-to-end: Compose infra + packaged jar + curl through the main flows
```

## 3. Web portal

```bash
cd workpulse-web
npm install
npm run dev        # http://localhost:5173, proxies /api and /ws to the backend
npm run typecheck && npm run lint && npm test -- --run && npm run build
```

Sign in with a demo account above, with the bootstrap super admin, or click **Continue as Guest**.

## 4. Desktop agent

```bash
cd workpulse-agent/electron
npm install
npm run dev        # Electron UI; set WORKPULSE_MOCK_SERVICE=1 to run without the Windows service
```

The Windows service and the collector are .NET 8 projects:

```powershell
cd workpulse-agent
dotnet build WorkPulse.Agent.sln -c Release
.\service\install-service.ps1      # run as Administrator
```

See `workpulse-agent/README.md` for installation, registration and troubleshooting.

## 5. Everything in containers

```bash
cd infra
docker compose --profile app up -d --build
# web portal: http://localhost:8080   backend: http://localhost:8081
```

## Conventions

* Branches: `main` (releasable), `develop`, feature branches `feat/<area>-<topic>`.
* Commit messages: conventional commits (`feat(backend): …`, `fix(web): …`).
* Every API change updates `docs/api/API_SPEC.md`; every event change updates `docs/api/EVENT_CONTRACTS.md`.
* Backend: one package per module, DTOs as records, permissions enforced with method security, scope
  enforced in services, every privileged write audited.
* Frontend: feature folders, RTK Query for data, no business logic in components, every page has
  loading, empty and error states.
* Never add mock data to production code paths. Guest Mode uses the backend's demo organisation.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Backend fails with `JWT secret must be at least 32 characters` | Set `WORKPULSE_JWT_SECRET` to a long random value |
| `Connection refused` to PostgreSQL | `docker compose ps` in `infra/`; wait for the healthcheck |
| `password authentication failed for user "workpulse"` | Another PostgreSQL is listening on the configured port (a local install on 5432 is common). Use the Compose default 55432 or point `WORKPULSE_DB_URL` at the right instance |
| Integration tests hang on container start | Ensure Docker Desktop is running and the daemon is reachable by the current user |
| Portal shows "demo session ended" | Guest sessions expire after `workpulse.jwt.guest-token-ttl` (2 h); start a new one |
| Agent shows "Service not reachable" | Install/start the `WorkPulse.Service` Windows service, or run the UI with `WORKPULSE_MOCK_SERVICE=1` |
