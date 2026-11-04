# WorkPulse Web Portal

React 19 · Vite 7 · TypeScript 5 · Material UI 7 · SCSS · Redux Toolkit (RTK Query) · React Router 7 · Recharts · Framer Motion.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server on http://localhost:5173 with `/api` and `/ws` proxied to the backend on :8080 |
| `npm run build` | Type-check (`tsc -b`) and production build to `dist/` |
| `npm run typecheck` | Type-check only |
| `npm run lint` | ESLint (flat config, typescript-eslint, react-hooks) |
| `npm test -- --run` | Vitest + Testing Library (jsdom) |
| `npm run preview` | Serve the production build locally |

## Structure

```
src/
  app/        store (auth + ui slices, RTK Query api), providers, router + guards
  components/ common · charts · tables · filters · dialogs · layouts
  features/   auth · guest · dashboard · live-monitoring · employees · departments · organizations
              users · devices · policies · audit · notifications · settings · privacy · user-manual · planned
  services/   axios client (bearer + X-Organization-Id + single-flight refresh), RTK Query endpoints, STOMP live socket
  hooks/      useAuth · usePermission · useLiveStatus · useDebounce
  constants/  permissions · roles · routes · navigation · status palette
  styles/     theme.ts (MUI light/dark from design tokens) · _tokens.scss · _mixins.scss · global.scss
  types/      API DTOs mirroring the backend
```

All data comes from the backend REST API; guest mode uses the backend's simulated demo organisation through the same endpoints. Modules scheduled for later phases render a labelled "Planned for Phase N" page instead of mock data.

## Configuration

Copy `.env.example` to `.env`. `VITE_API_BASE_URL` defaults to `/api/v1` (proxied in dev, served by nginx in Docker).

## Docker

`Dockerfile` builds the SPA and serves it with nginx, proxying `/api/` and `/ws/` to the `backend` service defined in `infra/docker-compose.yml`.
