# MSG91 Setup (SMS + WhatsApp)

Use this runbook to configure MSG91 for order notifications.

## 1) Prepare MSG91 account

1. Sign in to MSG91 dashboard.
2. Complete account/KYC setup and required DLT onboarding for India.
3. Create an Auth Key with API access.

## 2) Create SMS template (Flow API)

Create an approved SMS template in MSG91 with these variables:

- `##VAR1##` -> order code
- `##VAR2##` -> order total
- `##VAR3##` -> tracking URL

Copy the template/flow ID and set:

- `MSG91_SMS_TEMPLATE_ID`

## 3) Create WhatsApp template

1. Connect your WhatsApp integrated number in MSG91.
2. Create/approve WhatsApp template in MSG91.
3. Template body should accept these ordered variables:
   - `body_1` -> order code
   - `body_2` -> order total
   - `body_3` -> tracking URL

Set:

- `MSG91_WHATSAPP_INTEGRATED_NUMBER`
- `MSG91_WHATSAPP_TEMPLATE_NAME`
- `MSG91_WHATSAPP_TEMPLATE_LANGUAGE_CODE` (e.g. `en`)
- `MSG91_WHATSAPP_TEMPLATE_LANGUAGE_POLICY` (default `deterministic`)

## 4) Environment values

Set these in production env:

```env
MSG91_AUTH_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
MSG91_DEFAULT_COUNTRY_CODE=+91
MSG91_SMS_TEMPLATE_ID=xxxxxxxxxxxxxxxx
MSG91_SMS_SHORT_URL=0
MSG91_SMS_SHORT_URL_EXPIRY=
MSG91_SMS_REALTIME_RESPONSE=
MSG91_SMS_ENDPOINT=https://control.msg91.com/api/v5/flow
MSG91_WHATSAPP_INTEGRATED_NUMBER=91xxxxxxxxxx
MSG91_WHATSAPP_TEMPLATE_NAME=order_confirmation
MSG91_WHATSAPP_TEMPLATE_LANGUAGE_CODE=en
MSG91_WHATSAPP_TEMPLATE_LANGUAGE_POLICY=deterministic
MSG91_WHATSAPP_ENDPOINT=https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/
DEFAULT_NOTIFICATION_PHONE=
```

Notes:

- Recipient numbers are normalized before sending.
- `DEFAULT_NOTIFICATION_PHONE` forces all SMS/WhatsApp notifications to one number (useful for testing).
- If SMS or WhatsApp template env vars are missing, that channel is skipped.

## 5) Deploy and test

1. Redeploy app after env update.
2. Place a test order.
3. Check order notification logs in app for `SENT`/`FAILED`.

## Official MSG91 references

- SMS send API: https://docs.msg91.com/sms/send-sms
- WhatsApp template send API: https://docs.msg91.com/whatsapp/template-bulk
