# Final 15-Minute Prelaunch Runbook

Run this in order just before opening traffic.

## 1) Set/Verify Production Secrets

1. Ensure all required keys are set in hosting secret manager.
2. Validate keys in your local production env mirror:

```bash
npm run env:check:prod
```

Reference template: `docs/production-env-template.env`.

## 2) Rotate Admin Password and Reseed Admin Only

1. Set new strong `ADMIN_PASSWORD` and `ADMIN_EMAIL` in production secrets.
2. Run admin-only reseed (safe for catalog):

```bash
npm run db:seed:admin
```

## 3) Run Production Migrations

```bash
npm run db:migrate:deploy
```

## 4) Configure Notification Providers

1. Resend: set and verify `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_TO_EMAIL`.
2. MSG91: set and verify `MSG91_AUTH_KEY`, `MSG91_SMS_TEMPLATE_ID`, `MSG91_WHATSAPP_INTEGRATED_NUMBER`, `MSG91_WHATSAPP_TEMPLATE_NAME`.

## 5) Verify Admin Brute-Force Protection

1. Confirm `/api/auth/callback/admin-credentials` returns `429` after repeated bad attempts.
2. Confirm Redis rate limit vars are present (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).

## 6) Final Build/Test Gate

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## 7) Post-Deploy Smoke Test

1. `GET /api/health` returns success.
2. Customer signup/login works.
3. Customizer + preview works.
4. Checkout and order placement works.
5. Track order works.
6. Admin login works at `/admin/login`.
7. Admin orders/catalog actions work.
8. Email/SMS/WhatsApp notifications are delivered.
