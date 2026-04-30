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

## Install paths

This repo dual-publishes. Pick the install path that fits your workflow:

| Install                      | What you get                                                      | Typical user                          |
|------------------------------|-------------------------------------------------------------------|---------------------------------------|
| `pip install gispulse`       | CLI + runtime ESB + API only (no UI)                              | servers, CI/CD, headless, power users |
| `pip install gispulse-portal`| Same as above **plus** the bundled SPA, served same-origin        | users who want the local workbench    |
| Hosted SPA on GH Pages       | Marketing site + Try-it demo against `demo.gispulse.dev` backend  | drive-by visitors                     |

The PyPI wheel ships the pre-built SPA inside the Python package and exposes it via:

```python
from gispulse_portal import PORTAL_DIST_PATH
# -> Path to the bundled SPA, ready to mount with FastAPI StaticFiles
```

The `gispulse portal` CLI command (in the `gispulse` package) detects
`gispulse_portal` and mounts it at `/portal` automatically. If the package is
not installed, it prints a helpful install hint instead of failing.

## Frontend dev

```bash
pnpm install
pnpm dev      # → http://localhost:5173
pnpm build    # → ./dist
pnpm test
```

By default the portal expects the engine at `http://localhost:8000`.
Override with `VITE_API_BASE_URL` env var.

```bash
# Run the engine separately
pip install gispulse[postgis,api,raster,network]
uvicorn gispulse.adapters.http.app:create_app --factory --port 8000
```

## Build & publish (maintainers)

This repo dual-publishes on every `v*.*.*` tag:

1. **GH Pages SPA** — `deploy.yml` runs on every `main` push, builds via
   `pnpm build`, and force-pushes the result to the `deploy` branch (served
   by GitHub Pages).
2. **PyPI wheel** — `release.yml` runs on tag push:
   - `pnpm install && pnpm build` (produces `./dist`)
   - copies `./dist` → `gispulse_portal/dist/` (so it gets included as
     `package_data`)
   - `python -m build --outdir python-dist` (produces wheel + sdist)
   - smoke-tests the wheel in a clean venv
   - publishes to PyPI via [trusted publisher
     (OIDC)](https://docs.pypi.org/trusted-publishers/) — no token in repo

### Local wheel build

```bash
pnpm install
pnpm build
rm -rf gispulse_portal/dist
cp -r dist gispulse_portal/dist
python -m build --outdir python-dist
ls -la python-dist/
# gispulse_portal-1.5.1-py3-none-any.whl
# gispulse_portal-1.5.1.tar.gz
```

### Local install smoke test

```bash
python -m venv /tmp/smoke && /tmp/smoke/bin/pip install --upgrade pip
/tmp/smoke/bin/pip install python-dist/gispulse_portal-*.whl
/tmp/smoke/bin/python -c "
from gispulse_portal import PORTAL_DIST_PATH
print(PORTAL_DIST_PATH)
assert PORTAL_DIST_PATH.is_dir()
assert (PORTAL_DIST_PATH / 'index.html').is_file()
print('ok')
"
```

### Version policy

The git tag is the single source of truth. The release workflow asserts that
the tag, `pyproject.toml`, and `gispulse_portal/__init__.py` `__version__`
all match before publishing — a mismatch fails the build.

## License

AGPL-3.0-or-later. Network use = source disclosure obligation. See [LICENSE](LICENSE).

For self-hosted or SaaS deployment with proprietary modifications, contact
ImagoData about the commercial dual-license at contact@imagodata.com.
