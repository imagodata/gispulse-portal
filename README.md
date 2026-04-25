# GISPulse Portal

Open-source web UI for the [GISPulse](https://github.com/imagodata/gispulse) geospatial engine.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](LICENSE)

## What's here

React + Vite + TailwindCSS portal — the public, AGPL-licensed companion to the
`gispulse` Python engine. Provides:

- **Map workspace** — MapLibre + DeckGL, layer tree, basemap switcher, style editor
- **Workflows workspace** — visual node editor (React Flow) for building rule pipelines
- **Datasets / Catalog / Schema** workspaces — browse, query, upload, inspect
- **Marketplace** — browse capability plugins (read-only)
- **Local login** — single-user authentication via API key

## What's NOT here (lives in private `gispulse-portal-pro`)

- Admin / RBAC pages (Users, ApiKeys, Audit, Schedules, Settings, Usage, Queue)
- SSO OIDC callback page
- Billing pages (Pricing, Subscription)
- AdminGuard component, AdminLayout, admin API client + store

These are extended at app composition time when `gispulse-portal-pro` is
installed alongside this package.

## Install / dev

```bash
pnpm install
pnpm dev      # → http://localhost:5173
pnpm build    # → ./dist
pnpm test
```

## Backend

By default the portal expects the engine at `http://localhost:8000`.
Override with `VITE_API_BASE_URL` env var.

```bash
# Run the engine separately
pip install gispulse[postgis,api,raster,network]
uvicorn gispulse.adapters.http.app:create_app --factory --port 8000
```

## License

AGPL-3.0-or-later. Network use = source disclosure obligation. See [LICENSE](LICENSE).

For self-hosted or SaaS deployment with proprietary modifications, contact
ImagoData about the commercial dual-license at contact@imagodata.com.
