# WorkPulse

**Enterprise Workforce Intelligence, Employee Activity Monitoring and Productivity Analytics.**

WorkPulse helps organisations understand how working hours are spent – application engagement,
attendance, idle periods, meetings, breaks, device health and unusual patterns – while staying
transparent to employees. It distinguishes "computer online" from "actually engaged", never equates
mouse movement with productivity, explains every classification, and keeps anomaly detection
human-reviewed.

## Applications

| Application | Path | Stack |
|---|---|---|
| Web Management Portal | [`workpulse-web/`](workpulse-web/) | React 19 · Vite · TypeScript · Material UI · SCSS · Redux Toolkit · Recharts · Framer Motion |
| Backend & Analytics Platform | [`workpulse-backend/`](workpulse-backend/) | Java 17 · Spring Boot 3.5 · PostgreSQL · Redis · RabbitMQ · WebSockets · Flyway · OpenAPI |
| Windows Desktop Agent | [`workpulse-agent/`](workpulse-agent/) | Electron + TypeScript UI · C#/.NET 8 collector · C#/.NET 8 Windows Service |
| Local infrastructure | [`infra/`](infra/) | Docker Compose (PostgreSQL 16, Redis 7, RabbitMQ 3.13) |

## Quick start

```bash
# 1. infrastructure
cd infra && cp .env.example .env && docker compose up -d && cd ..

# 2. backend (migrations, bootstrap admin and demo organisation run automatically)
cd workpulse-backend && ./mvnw spring-boot:run

# 3. web portal (new terminal)
cd workpulse-web && npm install && npm run dev      # http://localhost:5173
```

Then either click **Continue as Guest** on the login page, or sign in:

| Account | Email | Password | Scope |
|---|---|---|---|
| Platform super admin | `admin@workpulse.local` | `ChangeMe!2026` | All organisations (select one in the top bar) |
| Demo org admin | `demo.admin@workpulse.demo` | `Demo!2026pass` | Demo organisation |
| Demo IT / HR / Manager / Lead / Employee / Auditor | `demo.it@…`, `demo.hr@…`, `demo.manager@…`, `demo.lead@…`, `demo.employee@…`, `demo.auditor@…` (`@workpulse.demo`) | `Demo!2026pass` | Role-scoped views of the demo organisation |

The demo organisation ("Northwind Analytics (Demo)") is entirely simulated and clearly labelled;
no real person is monitored. A demo activity simulator stands in for the desktop agents and keeps
the live view moving during the demo organisation's working hours (weekdays 08:45–18:45 IST);
outside those hours the simulated workforce is offline, as a real one would be.

API documentation: http://localhost:8080/swagger-ui.html

## Documentation

| Document | Content |
|---|---|
| [docs/architecture/ARCHITECTURE.md](docs/architecture/ARCHITECTURE.md) | System context, modular monolith, activity pipeline, security, real-time, Azure topology |
| [docs/architecture/DATABASE.md](docs/architecture/DATABASE.md) | ER diagram, tables, indexes, partitioning, retention |
| [docs/architecture/RBAC.md](docs/architecture/RBAC.md) | Roles, scopes, permission catalogue and the role/permission matrix |
| [docs/api/API_SPEC.md](docs/api/API_SPEC.md) | REST conventions, envelope, every endpoint with its permission and delivery phase |
| [docs/api/EVENT_CONTRACTS.md](docs/api/EVENT_CONTRACTS.md) | Agent event envelope and payloads, batch protocol, IPC, RabbitMQ and WebSocket contracts |
| [docs/architecture/DESIGN_SYSTEM.md](docs/architecture/DESIGN_SYSTEM.md) | Colour tokens, typography, motion, layout, components, accessibility |
| [docs/agent/AGENT_ARCHITECTURE.md](docs/agent/AGENT_ARCHITECTURE.md) | Service / collector / UI responsibilities, data flow, registration, security, lifecycle |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Setup, commands, conventions, troubleshooting |
| [docs/ROADMAP.md](docs/ROADMAP.md) | The twelve delivery phases and the Phase 1 checklist |

## What Phase 1 delivers

* Architecture, data model (Flyway baseline), RBAC matrix (seeded), API and event contracts.
* Backend: JWT auth with refresh-token rotation and reuse detection, RBAC enforced with method
  security, organisation isolation and department/team/self scoping, users and invitations,
  organisations, departments, teams, employees, devices, agent registration and device tokens,
  idempotent activity ingestion with explainable live status and timelines, executive and
  personal dashboards, monitoring policy resolution, audit and data-access logs, notifications,
  public Guest Mode on a seeded demo organisation, WebSocket live topic, OpenAPI docs,
  Testcontainers-based integration tests.
* Web portal: design system (light/dark), login + Guest Mode, responsive app shell, role-based
  navigation and dashboards for every role, live monitoring, employees, departments/teams, users,
  devices, policies, audit, notifications, settings, privacy information and help centre.
* Desktop agent: Electron UI with visible monitoring status, C# Windows Service and user-session
  collector with the named-pipe protocol, encrypted offline queue and batch synchronisation.
* Docker Compose for local development, CI workflow, documentation.

Later phases (attendance rules, application analytics, anomaly detection, reports, authorised
guests, privacy centre, MFA/SSO, Azure deployment) are listed in the roadmap and shown in the
portal as clearly labelled "planned" pages rather than mock screens.

## Licence

Proprietary – internal use.
