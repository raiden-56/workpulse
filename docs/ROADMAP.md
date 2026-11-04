# WorkPulse – Development Roadmap

Each phase is completed, built and tested before the next one begins.

| Phase | Scope | Status |
|---|---|---|
| 1 | Project setup and architecture: repo structure, docs, DB design, RBAC matrix, API + event contracts, design system, login + guest mode, layouts, role dashboards, employee + device screens, backend + agent scaffolds, Docker Compose, README | **Delivered 2026-11-04** (backend tests, portal build/tests, Electron build/tests and the Compose stack verified; C# agent projects await a .NET 8 SDK build) |
| 2 | Design system hardening, full auth flows (forgot/reset/invite/activate), RBAC UI, dashboards wired to analytics | Planned |
| 3 | Employee, organisation, department, team management incl. CSV import/export | Planned |
| 4 | Remaining backend APIs and migrations (attendance, applications, policies, notifications, reports) | Planned |
| 5 | Windows desktop agent: service, collector, UI, installer | Planned |
| 6 | Activity collection, derivation pipeline (RabbitMQ), classification engine, offline sync hardening | Planned |
| 7 | Attendance rules, shifts, breaks, corrections, application usage analytics | Planned |
| 8 | Live workforce monitoring over WebSockets | Planned |
| 9 | Anomaly detection (rules), review workflow | Planned |
| 10 | Reports (CSV/PDF/XLSX) and notification centre | Planned |
| 11 | Guest mode completion (authorised guests), privacy and compliance centre, user manual | Planned |
| 12 | Security hardening (MFA, Entra ID SSO, rate limiting, scanning), test suites, Azure deployment, CI/CD | Planned |

## Phase 1 deliverable checklist

- [x] Architecture overview (`docs/architecture/ARCHITECTURE.md`)
- [x] Repository and folder structure
- [x] Database ER diagram (`docs/architecture/DATABASE.md`) + Flyway baseline
- [x] Role and permission matrix (`docs/architecture/RBAC.md`) + seed migration
- [x] API endpoint specification (`docs/api/API_SPEC.md`) + OpenAPI from code
- [x] Event contract specification (`docs/api/EVENT_CONTRACTS.md`)
- [x] Design system and theme (`docs/architecture/DESIGN_SYSTEM.md`, `workpulse-web/src/styles`)
- [x] Login and Guest Mode experience
- [x] Responsive application layouts
- [x] Dashboard pages for every role
- [x] Employee and device management screens
- [x] Initial backend project (auth, RBAC, tenancy, employees, devices, agent registration, activity ingestion, guest, audit, dashboard)
- [x] Initial Windows desktop agent project (Electron UI, C# collector, C# service, IPC contracts)
- [x] Local development Docker Compose
- [x] README and development instructions
