# Custom Clothing 

Production-focused for customizable clothing with:
- 7-step design-to-checkout flow
- Fabric.js editor (text, upload, paint tools)
- 360 preview before approval
- COD checkout and order ID tracking
- Admin dashboard for orders and catalog pricing
- Prisma + PostgreSQL backend

## Stack
- Next.js (App Router) + TypeScript
- Tailwind CSS
- Prisma + PostgreSQL
- NextAuth credentials auth (admin)
- Fabric.js + React Three Fiber
- Resend + MSG91 notification hooks

## Quick Start
1. Install dependencies

```bash
npm install
```

2. Configure environment

```bash
cp .env.example .env
```

3. Start local PostgreSQL (keep this running in a separate terminal)

```bash
npm run db:local:start
```

4. Set your local `DATABASE_URL` in `.env` (default already points to `127.0.0.1:55432`)

5. Generate Prisma client and sync schema

```bash
npm run db:generate
npm run db:push
```

6. Seed base catalog and admin user

```bash
npm run db:seed
```

7. Run development server

```bash
npm run dev
```

## Default Admin Credentials (seed)
- Email: value of `ADMIN_EMAIL` in `.env`
- Password: value of `ADMIN_PASSWORD` in `.env`

## Core Routes
- `/` landing page
- `/customize` select product
- `/customize/[productSlug]` editor flow
- `/customize/[productSlug]/preview` 360 approval step
- `/checkout` signed-in customer COD checkout
- `/order/confirmation/[orderId]` order confirmation
- `/track-order` tracking by order ID + phone
- `/admin/login` admin login
- `/admin/orders` admin orders
- `/admin/catalog` admin catalog

## APIs
- `GET /api/catalog`
- `POST /api/designs/draft`
- `PATCH /api/designs/draft/:id`
- `POST /api/designs/draft/:id/upload`
- `POST /api/designs/draft/:id/export`
- `POST /api/orders`
- `POST /api/orders/:orderId/notify` (admin session or `x-internal-notify-secret` required)
- `POST /api/track-order`
- `GET /api/health`
- `POST /api/admin/auth/login`
- `GET /api/admin/orders`
- `PATCH /api/admin/orders/:id/status`
- `GET /api/admin/catalog`
- `PATCH /api/admin/catalog`

## Storage
Storage proxy route:
- `/api/storage/orders/...`
- `/api/storage/saved-drafts/...`

Behavior:
- Draft uploads are stored under `storage/saved drafts`.
- Order print images are generated only when an order is placed.
- Order files are stored as `storage/orders/<year>/<month>/<orderCode>/<orderCode>_<area>.png`.
- Storage root can be overridden with `STORAGE_ROOT_PATH` for persistent mounts in production.

## Backup & Restore
- backup script: `scripts/backup.sh`
- restore script: `scripts/restore.sh`
- runbook: `docs/restore-runbook.md`
- public launch requirements: `docs/public-launch-requirements.md`
- MSG91 setup runbook: `docs/msg91-setup.md`

## Tests
```bash
npm run test
npm run lint
npm run typecheck
```

## Notes
- COD is active at launch.
- Online payment methods are schema/API-ready but intentionally not enabled in checkout UI yet.
- 3D preview currently uses procedural model placeholders; replace with production GLB assets under a dedicated model pipeline.

