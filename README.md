# Oroud

Oroud helps buyers in Amman find current shop offers. Shops share offers through WhatsApp and Instagram, and AI turns each post into a structured, searchable offer.

The product spec is the "Oroud Offers Aggregator — Developer Specification" (Nov 2026). Requirement IDs in code comments (for example `FR-AI-05`) refer to it.

## Layout

| Path | What it is |
| --- | --- |
| `apps/api` | Backend API (Fastify, TypeScript), SQL migrations and, later, webhooks and jobs |
| `packages/extraction` | AI extraction service: turns a caption, message or screenshot into a validated offer with Claude (spec section 6) |
| `packages/shared` | Shared helpers: Arabic search normalisation, JOD money, Asia/Amman dates, Instagram username and link parsing |

Planned next: `apps/web` (Next.js admin console, link-in-bio and Google pages) and `apps/mobile` (Expo app for iOS and Android).

## Running locally

Needs Node 22 and Docker.

```bash
cp .env.example .env          # then fill in ANTHROPIC_API_KEY
docker compose up -d          # Postgres with PostGIS, and Redis
npm install
npm run db:migrate
npm run dev:api               # http://localhost:3000/health
```

## Checks

```bash
npm run typecheck
npm test                      # database tests run when TEST_DATABASE_URL is set
```
