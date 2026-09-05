# H5/H6: order and payment lifecycle

Implemented locally, 2026-09-06. Not deployed. H1 remains enforced.
This document supersedes the original audit's H5/H6 implementation status,
not its other findings or the requirement for sandbox and infrastructure checks.

## Reservation and order state

Product.stockQuantity and stockContentAmount now represent AVAILABLE inventory:
physical inventory less active reservations. No new independent product counter
can drift from existing CRM sales. StoreOrder.reservationState records:

- LEGACY: old orders, no invented reservation.
- ACTIVE: packages and configured content removed from available stock, TTL 30 minutes.
- RELEASED: unpaid cancellation, invoice rejection/failure/expiry, or reservation timeout.
- CONSUMED: verified payment converted the reservation into a sale.

Order creation locks product rows in ascending ID order and reserves with
conditional updates in the same transaction as the order/items. A failed item
rolls back the whole order. Other CRM inventory readers/writers that calculate
new stock now take the same product locks. Product-editor stock/package changes
cannot overwrite active reservations; the stock movement form adjusts free stock.

Reserve/release use StockMovement ADJUSTMENT entries with actual signed deltas.
On payment, a SALE entry has delta 0 and records the converted package count in
its reason: available stock was already reduced. Do not sum SALE quantities alone
to count sold units; order items contain sales quantities. Content reserved per
item is snapshotted for release. stockDeductedAt is set on conversion, not reserve.

Normal order flow:

PENDING + ACTIVE -> verified PAID + CONSUMED -> CONFIRMED -> PROCESSING ->
SHIPPED -> COMPLETED.

Unpaid cancellation or local TTL expiry -> CANCELLED + RELEASED.
Definite attempt failure/expiry releases stock while leaving PENDING, allowing an
explicit retry to re-reserve with a fresh availability check and TTL.
Payment PAID cannot be retried or cancelled; refund must be confirmed first.
Refund alone does not claim physical goods were returned. An allowed subsequent
CRM cancellation returns consumed inventory once, tracked by stockRestoredAt.

Expired reservations are released in bounded batches on checkout creation and
on status/pay access. A scheduled maintenance run is REQUIRED to free abandoned
reservations without visitor traffic. Delayed cleanup temporarily undersells,
never makes reserved inventory available to two orders.

## Idempotency and H1

The storefront generates 32 cryptographically random bytes as Idempotency-Key,
persisted in sessionStorage before the request. Same-payload submits/network
retries reuse it; a changed payload starts a new checkout/key. A ref guards
double-clicks, and the submit button is disabled during the request.
The stored payload fingerprint is a hash, not contact details.

Backend stores a unique SHA-256 key hash plus a deterministic normalized request
hash. A transaction-scoped advisory lock serializes concurrent use of the key;
the unique index is the durable backstop. Same key/payload returns the same order
with its current status; changed payload returns 409. Restart does not lose this.

The H1 owner token remains server-generated random bytes with a SHA-256 verifier.
For response-loss recovery, its encrypted copy is stored using AES-256-GCM,
random IV and request hash as AAD. The encryption key is domain-separated SHA-256
of the 256-bit client Idempotency-Key; neither that key nor plaintext owner token
is persisted on the server. Replays decrypt only with the original key and payload.
No new Railway secret is needed. Idempotency-Key is therefore ALSO a bearer secret:
never log either ownership header or creation response bodies.

Sensitive order status/pay still require X-Order-Access-Token. Pay checks it again
inside the order lock. A bank redirect carries orderId only and never marks PAID.
sessionStorage holds only the current checkout and current order credential.
Clearing the session loses public recovery; CRM access remains authenticated.
After confirmed payment the checkout key is cleared, allowing a new purchase.

## Payment attempts

PaymentAttempt records UUID/reference, order, attempt number, provider invoice ID,
amount, currency, URL, timestamps and sanitized failure code. Unique constraints
protect invoice ID and order/attempt number. A partial unique index permits only
one CREATING/PENDING/UNKNOWN attempt per order.

CREATING -> PENDING -> PAID -> REFUNDED.
CREATING -> FAILED for definite rejection.
CREATING -> UNKNOWN for network timeout, ambiguous response or interrupted worker.
PENDING -> FAILED / EXPIRED, allowing an explicit new attempt after re-reservation.
FAILED / EXPIRED -> late PAID is recorded, never silently lost.

Pay first commits the attempt under an order lock, then calls the bank OUTSIDE
the transaction, then binds the returned invoice. A concurrent caller receives
the active state/URL instead of creating another invoice. Maximum 5 attempts per
order; PAID, REFUNDED, CANCELLED, review and legacy orders cannot start new ones.
An unfinished CREATING attempt becomes UNKNOWN after 30 seconds.

Payment events lock the order and reload the attempt. Signed webhooks bind only
by saved providerInvoiceId, never by an unbound reference. Known references,
amount, currency and final amount are checked. Strict per-attempt modifiedDate
ordering prevents replay; PAID cannot revert to pending/failed, REFUNDED is terminal.
Full refunds are modeled; partial refunds/mismatches require manual review.

An old invoice success after retry stays in its own history. The first successful
attempt settles the order; another paid attempt raises MULTIPLE_PAYMENTS without
another stock deduction. If a reserve has expired/released, the order is cancelled,
or the order is legacy, late payment is recorded with requiresReview and no automatic
fulfillment or negative stock. CRM shows a payment warning and blocks fulfillment.

## Reconciliation and uncertain creation

Known invoice IDs are checked server-to-server via Monobank invoice/status.
Webhook and status responses use the same transition function. lastCheckedAt is
claimed atomically, at most once per attempt per 60 seconds across replicas.
Each access checks at most 5 attempts, including older failed attempts for late
success and settled attempts for refunds. Storefront polling lasts up to 2 minutes.

The documented status API requires invoiceId; this implementation does not assume
a reliable lookup of an unpaid invoice by merchant reference. If creation times out
without that ID, UNKNOWN blocks automatic retry even after restart. A signed
unbound callback is not enough to attach an invoice by reference.

Operator recovery:

1. Obtain the invoice ID from the merchant dashboard/support using the attempt
   reference, without creating a replacement invoice.
2. Run, in the backend environment with its ordinary secret variables:

   ALLOW_PAYMENT_RECOVERY=true npm run payments:maintain -- ATTEMPT_UUID INVOICE_ID

   Or, for runtime images without tsx:

   ALLOW_PAYMENT_RECOVERY=true node dist/scripts/payment-maintenance.js ATTEMPT_UUID INVOICE_ID

3. Recovery fetches the bank status and requires the exact reference, amount and
   currency before binding an unbound CREATING/UNKNOWN attempt. It then applies the
   shared transition. It does not invent a payment URL from the invoice ID.
4. If no invoice can be identified, leave UNKNOWN blocked, let the reserve expire,
   and verify the outcome with the bank. Never manually set FAILED just to retry.

Review cases deliberately do not auto-refund, auto-ship, or clear their review flag.
For duplicate/late/partial payments an operator must reconcile ALL attempts with
the bank and arrange a refund or separately verified fulfillment. The review flag
stays as an audit warning; there is no generic public/admin button to bypass it.
Manual resolution UI and automatic refund orchestration are not included.

## Maintenance and observability

Schedule every minute on Railway using the same backend database/bank variables:

    node dist/scripts/payment-maintenance.js

The source equivalent is npm run payments:maintain in backend. This is NOT wired
into build/start/migrations. Each run releases at most 200 expired reservations,
then selects up to 100 oldest unchecked attempts. Reconciliation is throttled
across replicas. Unbound attempts advance their check timestamp for queue fairness.
For larger volume monitor backlog/latency and adjust scheduling/batch capacity.
The bounded run can take longer during bank outages; avoid overlapping cron runs.

Durable OrderLifecycleEvent rows are written transactionally for reservation,
invoice creation/binding/recovery, failures, reconciliation needed, success,
mismatch, late success, refund and cancellation. They contain IDs and fixed reason
codes, not contact details or tokens. Existing CRM order JSON includes safe attempt
summaries. Monitor UNKNOWN/CREATING age, requiresReview, expired ACTIVE backlog and
maintenance_failed. Application events are durable DB records, not external alerts;
operators still need to configure notification/monitoring in production.

## Migration and rollout

Migration: 20260905170000_store_payment_lifecycle.
Adds nullable idempotency/recovery data, reservation metadata, attempts and event
tables; existing invoices are copied into legacy attempts. No stock is changed.
Existing paid/refunded invoice settlement and historical stock deduction remain.
No reset, drop, real-order deletion or fake reservation is performed.

Old orders default LEGACY. No new invoice/retry is permitted for them. Existing
callbacks still bind by invoice ID. A previously paid/deducted legacy order is
not deducted again. A legacy order paid without historical deduction requires a
real availability check on confirmation; new legacy payment is flagged for review.
Orders without H1 hashes remain publicly inaccessible.

Production steps:

1. Backup database; check UTC PostgreSQL session timezone. Existing analytics uses
   UTC-stored timestamp columns and local date ranges; non-UTC DB timezone exposed
   a midnight boundary issue in testing. Analytics was not refactored in this task.
2. Pause checkout and old payment workers during rollout. Apply prisma migrate
   deploy and generate Prisma Client; deploy backend and product-store together.
   Old backend writers must not run alongside the new reservation semantics.
3. Verify migration against a staging copy and check old pending invoice inventory
   manually. Review existing callbacks and already-shared legacy invoice links.
4. Enable the maintenance schedule, monitor its exit status/backlog, and redact
   Idempotency-Key/X-Order-Access-Token at proxy and APM layers.
5. Verify sandbox payment/return/refund with matching storefront return origin.
   Do not begin real payments until the other audit/infrastructure blockers are
   resolved. This task does not rotate previously disclosed credentials.

## Verification

64 backend tests passed, including actual concurrent requests/transactions:
last-item checkout, CRM/store race, durable idempotency, active-attempt constraint,
cancel/release, retry, no network-held order lock, replay/late success, amount/ccy,
lost callback, unknown recovery, legacy settlement, H1 and admin regression.
Test files run sequentially to isolate shared database analytics fixtures; requests
inside concurrency cases run in parallel. Temporary database session timezone UTC.
5 storefront tests passed: storage, header-only access and persisted concurrent keys.

All 25 migrations applied on empty disposable PostgreSQL. A separate pre-migration
database with synthetic PAID/PENDING invoices preserved both attempts and the paid
deduction/settlement after migration. No production migration or real bank request
was performed. ECDSA signatures are real test signatures; bank transport is mocked.

Prisma generate, backend/storefront builds, npm audit (0 both repos) and
git diff --check were run. See the final task response for final verification state.

Changed files:

- Backend Prisma schema + the migration above.
- catalog/{catalog.repository,catalog.routes,catalog.service,order-access,
  order-idempotency,order-lifecycle}.ts.
- payments/monobank.service.ts; admin/admin.service.ts.
- src/scripts/payment-maintenance.ts; backend/package.json.
- tests/order-lifecycle.test.ts, order-access.test.ts, payments-security.test.ts.
- Storefront src/{api,types,checkout-idempotency}.ts;
  pages/{CheckoutPage,PaymentResultPage}.tsx; tests/{order-access,checkout-idempotency}.test.ts.
- This follow-up and cross-references in the earlier audit/H1 documents.

Reference: [Monobank acquiring API](https://api.monobank.ua/docs/acquiring.html)
for create, invoice/status, validity and signed callbacks. No reference-search API
or provider-side idempotency guarantee is assumed.
