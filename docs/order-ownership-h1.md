# H1: public order ownership

Follow-up: [H5/H6 lifecycle](./order-payment-lifecycle-h5-h6.md) adds required
Idempotency-Key on creation and encrypted owner-token recovery for idempotent
replays. The one-time creation response description below is the original H1
contract; replay now reissues the same token only to the original key holder.

Implemented locally on 2026-09-05. This follow-up supersedes the open-H1
status in the original security audit; other findings remain unchanged.

## Contract

- POST /api/public/orders generates 32 random bytes and returns accessToken
  once alongside the order DTO. Only its SHA-256 hash is persisted.
- GET /api/public/orders/:id/payment-status and POST /api/public/orders/:id/pay
  require X-Order-Access-Token. The service verifies ownership before reading
  payment details or invoking invoice creation. Fixed-length hashes are
  compared with timingSafeEqual.
- Missing, malformed, wrong, cross-order and legacy tokens receive the same
  404 response as unknown orders. Public order responses use Cache-Control:
  no-store. Status/pay/admin DTOs do not expose either the token or its hash.
- No public order-detail endpoint exists. The payment-result page reads the
  protected status endpoint; an order ID or navigation state is not authority.

## Storefront

The single sessionStorage record sl-current-order-access contains only the
current order ID and token. Creating another order replaces it. Storage is
checked before submitting checkout and the returned token is saved before
navigation to the bank. Status and retry requests carry the token in a header,
never in the URL, request body, analytics or application logs.

Monobank receives the existing redirect with orderId only. The redirect does
not prove payment: existing verified webhook processing determines status.
Refreshing the original tab retains access. Closing the session, clearing
storage, using a different origin/browser, or losing the creation response can
lose access. There is intentionally no recovery by ID/phone/email; contact the
salon, whose authenticated CRM access remains unchanged. Some browser-created
tabs may inherit sessionStorage; possession of the token grants access.
The same-origin JavaScript/XSS risk of browser storage is not solved by H1.

## Deployment

1. Apply 20260905150000_store_order_access_token with prisma migrate deploy.
   It only adds nullable access_token_hash VARCHAR(64), without rewriting
   existing rows, deleting data or resetting the database.
2. Generate Prisma Client and deploy the backend and product-store together.
   An old storefront cannot read/retry orders against the new protected API.
3. Ensure the bank return origin exactly matches the checkout storefront
   origin, and reverse proxies allow X-Order-Access-Token. Do not log this
   header or creation response bodies at the proxy/analytics layer.
4. Orders created before the migration have NULL hashes and are unavailable
   through public sensitive routes. CRM and signed bank callbacks still work.

## Verification

Prisma generate, backend build and storefront build passed. All 24 migrations
applied to isolated temporary PostgreSQL. Backend: 45 passed, none skipped;
storefront: 3 passed. Coverage includes hash-only persistence, independent
tokens, ID enumeration, status/pay ownership, legacy access, CRM listing,
CORS, header-only transport, session storage and signed Monobank callbacks
for an order with an access hash. Bank transport is mocked; no real payment
or production migration was run. git diff --check passed in both repos.

Files: backend Prisma schema and new migration; catalog order-access helper,
repository, service and routes; order-access and payment security tests.
Storefront: src/order-access.ts, src/api.ts,
src/pages/PaymentResultPage.tsx, tests/order-access.test.ts.
