# Public Launch Requirements

This file tracks what is already hardened in code and what is still required from infrastructure/business owners before public launch.

## Implemented In This Repository

- Global security headers added in `next.config.ts`:
  - CSP
  - HSTS
  - X-Frame-Options
  - X-Content-Type-Options
  - Referrer-Policy
  - Permissions-Policy
- Shared-capable rate limiter:
  - Redis-backed via Upstash REST (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`)
  - Automatic in-memory fallback if Redis is missing/unavailable
- Rate limiting added/updated for:
  - admin login
  - customer signup
  - draft upload
  - track order
  - contact form
  - order placement
- Notification hardening:
  - Checkout no longer calls public notify endpoint directly
  - Order notifications dispatch server-side during order placement
  - `/api/orders/:orderId/notify` now requires admin session or internal secret header
  - Notification channels are skipped when not configured (instead of forcing failed order status)
- Order confirmation hardening:
  - Only admin or owning customer can open `/order/confirmation/[orderId]`
  - Notification logs shown only for admins
- Backup path alignment:
  - `scripts/backup.sh` now backs up `storage/orders` and `storage/saved drafts` by default
  - Runbook updated in `docs/restore-runbook.md`
- Operational endpoint:
  - `GET /api/health` with DB check
- CI baseline:
  - GitHub Actions workflow at `.github/workflows/ci.yml` running lint/typecheck/test/build

## Required From You (Cannot Be Auto-Completed In Code)

## 1) Production Infrastructure Decisions

- Final hosting target (VPS, Docker host, Vercel, etc.)
- Production PostgreSQL instance details
- Persistent storage strategy:
  - Shared disk mount, or
  - Object storage (S3/R2/GCS) + credentials

## 2) Production Environment Values

Set these in production secrets manager / environment:

- `DATABASE_URL`
- `NEXTAUTH_URL` (your public HTTPS domain)
- `NEXTAUTH_SECRET` (strong random secret)
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD` (strong, unique)
- `PUBLIC_STORAGE_BASE_URL` (likely `/api/storage` unless changed)
- `STORAGE_ROOT_PATH` (optional; set to a persistent mounted path for file storage)
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `RATE_LIMIT_REDIS_PREFIX` (optional; defaults to `cc_rl`)
- `INTERNAL_NOTIFY_SECRET` (strong random value)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CONTACT_TO_EMAIL`
- `MSG91_AUTH_KEY`
- `MSG91_SMS_TEMPLATE_ID`
- `MSG91_WHATSAPP_INTEGRATED_NUMBER`
- `MSG91_WHATSAPP_TEMPLATE_NAME`

## 3) Domain / DNS / TLS

- Point domain DNS to your production host
- Enforce HTTPS
- Confirm TLS certificate auto-renewal

## 4) Email/SMS Deliverability Setup

- SPF, DKIM, DMARC for sender domain (Resend)
- MSG91 DLT + template provisioning (SMS/WhatsApp)

## 5) Legal + Policy Content

- Terms & Conditions page content
- Shipping policy
- Refund/Cancellation policy
- Contact/legal company details

## 6) Monitoring / Alerting

- Uptime monitor configured for:
  - `/api/health`
  - landing page
- Error monitoring (for API/runtime exceptions)
- Alerts to your team channel/email/phone

## 7) Data Protection / Operations

- Schedule daily backup cron with `scripts/backup.sh`
- Set retention policy (`RETENTION_DAYS`)
- Perform and document monthly restore drill

## Go-Live Verification (Final Pass)

Run before switching traffic:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run db:migrate:deploy
```

Manual QA on production-like environment:

- customer signup/login
- customization flow
- 360 preview
- checkout and order placement
- order tracking
- admin login/orders/catalog
- email/SMS/WhatsApp notifications
