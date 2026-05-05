# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

iAgents is a Shopify embedded app that provides an AI-powered sales assistant widget for Shopify stores. It integrates with the iAgents platform (dashboard.iagents.pro) to deliver a chat widget that can search products, check inventory, and assist customers. Built on the Shopify React Router app template.

## Commands

- **Dev server:** `npm run dev` (runs `shopify app dev`, which handles tunneling, env vars, and Prisma setup)
- **Build:** `npm run build` (runs `react-router build`)
- **Lint:** `npm run lint`
- **Type check:** `npm run typecheck`
- **Prisma generate + migrate:** `npm run setup`
- **Deploy to Shopify:** `npm run deploy`
- **GraphQL codegen:** `npm run graphql-codegen`

## Architecture

### Tech Stack
- **Framework:** React Router v7 (migrated from Remix) with file-system routing
- **Shopify integration:** `@shopify/shopify-app-react-router` for auth, webhooks, and App Bridge
- **Database:** Prisma with SQLite (stores session data in `prisma/schema.prisma`)
- **UI:** Shopify Polaris Web Components (`<s-page>`, `<s-section>`, `<s-text-field>`, etc.)
- **Build:** Vite with `vite-tsconfig-paths`

### Key Files
- `app/shopify.server.js` — Shopify app configuration, exports `authenticate`, `login`, `sessionStorage`, etc. All server-side auth flows go through this.
- `app/routes.js` — Uses `flatRoutes()` from `@react-router/fs-routes` for filesystem-based routing.
- `app/routes/app.jsx` — Layout route for authenticated app pages. Wraps children in `AppProvider` with App Bridge.
- `app/routes/app._index.jsx` — Main app page with widget configuration UI (agent ID, colors, position, theme).

### API Routes (unauthenticated by external services)
- `api/products` — Search/list products via Shopify Admin GraphQL API
- `api/products.$handle` — Get single product by handle
- `api/catalog` — Product catalog endpoint
- `api/inventory` — Inventory/stock levels endpoint
- `api/widget` — Serves an HTML page embedding the iAgents chat widget script

### Webhook Handlers
Defined in `shopify.app.toml` and handled by server-only routes:
- `webhooks/checkout/create.server.jsx`, `webhooks/checkout/update.server.jsx`
- `webhooks/order/create.server.jsx`, `webhooks/order/update.server.jsx`
- `webhooks.app.uninstalled.jsx`, `webhooks.app.scopes_update.jsx`

### Shopify-Specific Patterns
- Use `authenticate.admin(request)` from `shopify.server.js` for all authenticated requests.
- Use `admin.graphql()` for Shopify Admin API queries, not REST.
- Use `Link` from `react-router` or Polaris for navigation — never `<a>` tags (breaks embedded iframe session).
- Use `redirect` from `authenticate.admin`, not from `react-router`.
- Webhooks are declared in `shopify.app.toml` (app-specific), synced on `npm run deploy`.
- Shopify API version: `October25` (set in `shopify.server.js`); webhook API version: `2026-07` (in `shopify.app.toml`).

### Scopes
`write_products, read_products, write_metaobjects, write_metaobject_definitions, read_inventory`

### Workspaces
`extensions/*` is configured as an npm workspace for Shopify app extensions.

### Windows Development Note
If Prisma fails with `query_engine-windows.dll.node` error, set `PRISMA_CLIENT_ENGINE_TYPE=binary`.
