# Private store operations

The advanced administration and commerce foundation is deliberately separate from the public GitHub Pages site. GitHub Pages cannot run authentication, SQLite, payments, tax, email, supplier automation, or customer-data APIs. Run `operations/server.mjs` on a private Node 24+ service with persistent disk, HTTPS termination, backups, monitoring, and restricted network access.

## Local setup

No package installation is required. Node's built-in SQLite module is used.

```powershell
npm.cmd run admin:categories
$env:ADMIN_EMAIL='owner@example.com'
$env:ADMIN_PASSWORD='use-a-long-unique-password'
$env:ADMIN_ROLE='owner'
npm.cmd run admin:user
Remove-Item Env:ADMIN_PASSWORD
npm.cmd run operations
```

The local service binds only to `127.0.0.1:8788`. Open `http://127.0.0.1:8788/admin/`. The database defaults to ignored `private/operations.sqlite`. Do not serve or commit `private/`.

Staff roles are `owner`, `catalog`, `fulfillment`, `support`, and `analyst`. Staff passwords use scrypt hashes. Sessions use random HttpOnly, SameSite=Strict cookies with eight-hour expiry. State-changing requests require exact-origin and CSRF checks. Production mode requires an HTTPS `APP_ORIGIN`; deploy behind a trusted reverse proxy and do not expose an alternate HTTP listener.

Set `OPERATIONS_DB` to an absolute persistent-disk path in production. Set `APP_ORIGIN` to the exact HTTPS administration origin, `OPERATIONS_PORT` to the local listener port, `NODE_ENV=production`, and optionally `OPERATIONS_ADAPTER_MODULE` to the absolute path of a reviewed adapter module. Keep adapter code and all credentials outside the public build.

## Product operations

The admin supports manual product/category/supplier records, CSV UTF-8 preview and atomic import, field mapping, duplicate detection, error rows, bulk status/category/brand editing, supplier associations, variant data and image URLs. Excel users can save the supplied template as CSV UTF-8; native XLSX parsing is intentionally absent to keep the server dependency-free. The public template is at `/downloads/product-import.csv` and the authenticated copy at `/api/admin/import/template`.

Imports are drafts. Active products require a real category/subcategory, product details, approved images, variants, USD prices, shipping/returns text, and SEO fields. Supplier automation is disabled. Published prices can change only through recorded pricing proposals; large changes require owner approval. Cost changes are audited. Inventory updates require a source, timestamp, non-negative quantity or explicit unknown status, and reject stale updates.

To publish approved products:

```powershell
npm.cmd run operations:export
npm.cmd run build
npm.cmd test
npm.cmd run deploy
```

The export contains only explicitly allowed public fields. Review the Git diff before deployment. Product and category records in the private database are authoritative only after the team adopts this workflow; avoid editing both JSON and SQLite independently.

## Adapter contract

The operations server accepts a default export from `OPERATIONS_ADAPTER_MODULE` with optional objects:

```js
export default {
  customerAuth: {
    async authenticate(request) { /* {id, email}, or null */ },
    async verifyCSRF(request, identity) { /* boolean */ }
  },
  tax: {
    async calculate({address, items, discountCents, shippingCents, currency}) {
      /* return {taxCents: integer, reference: 'provider-id'} */
    }
  },
  payments: {
    stripe: {
      allowedCheckoutHosts: ['checkout.stripe.com'],
      async createSession({order, idempotencyKey}) { /* {id, url} */ },
      async verifyEvent(rawBytes, headers) { /* normalized verified event */ },
      async requestRefund({order, idempotencyKey}) { /* {id} */ }
    },
    paypal: { /* same normalized contract */ }
  },
  email: {
    async send({to, subject, text, idempotencyKey}) { /* {id} */ }
  }
};
```

Adapters must use official provider SDKs or documented APIs. Webhook adapters receive exact raw bytes and must verify signatures, timestamp freshness, provider event semantics, and the current provider object before returning a normalized event. The commerce layer also deduplicates event IDs and checks order, reference, amount, and USD currency. Hosted payment destinations are allowlisted. No raw card data belongs in this service.

Normalized paid/refunded events require `{id, type, orderId, reference, amountCents, currency}`. `verifyStripeSignature` in `operations/payment-security.mjs` is a dependency-free raw-body signature helper; production adapters still need provider retrieval/reconciliation and secret rotation handling. PayPal requires its own documented signature verification process.

The tax adapter is required before quotes. The customer identity adapter is required before customer commerce endpoints. Payments are required before hosted checkout. Supplier forwarding has no adapter and cannot be enabled from settings. This prevents unreviewed orders from reaching suppliers.

## Checkout and automation

The server re-reads variants and prices, requires recent known inventory, resolves configured US shipping rules, calculates tax through the adapter, validates promotions, creates an idempotent pending order, reserves inventory, and creates a hosted payment session. Inventory is decremented only after a verified paid webhook. Risk flags block processing. Status changes use a fixed transition graph and timestamped history.

The background worker identifies consented abandoned recoveries and drains the notification outbox:

```powershell
$env:RECOVERY_ENABLED='true'
$env:CUSTOMER_PORTAL_ORIGIN='https://account.example.com'
npm.cmd run operations:worker
```

Schedule it with one supervised instance or add a database-backed distributed job lease before horizontal scaling. Recovery remains off unless explicitly enabled with customer identity, HTTPS portal, consent, and email adapter. The queue retries with backoff, deduplicates event keys, and distinguishes provider acceptance from confirmed delivery. Provider delivery webhooks must call `confirmDelivery` only after their signatures are verified.

## Shipping, returns, support and reporting

Shipping rules contain actual configured US states, optional ZIP prefixes, standard/expedited types, integer-cent costs, optional free thresholds, estimates, and product exclusions. No default prices, delivery guarantees, or tax rates are created.

Customer tracking, order history, returns, tickets, recovery, and preferences require verified customer identity and CSRF. Returns require the configured policy window and an order owned by the customer; approval does not execute a refund. Only an owner can submit a full provider refund, and the order becomes refunded only after a verified provider event.

Reports use recorded order and checkout data. Conversion remains unavailable without real sessions. Profit appears only to owners and only when every required cost is recorded; it is labeled estimated. Supplier/internal fields are removed from non-owner order responses and public exports.

## Marketing

The public site records optional browser consent and UTM values only after analytics consent. It does not load GA4, Google Ads, Meta Pixel, chat, or email scripts. Empty Google XML and Meta CSV feeds are generated now and populate only from active real products and known availability. Configure each external destination only after business approval, privacy documentation, consent-region requirements, and provider credentials are complete.

## Production checklist

- Choose a managed identity provider for customers and provision staff accounts privately.
- Deploy the operations server to persistent Node hosting with HTTPS, encrypted backups, log redaction, patching and monitoring.
- Implement reviewed Stripe/PayPal sandbox adapters and signed webhook endpoints.
- Configure a US tax service, real shipping zones/rates, inventory freshness window, supplier records and approved returns policy.
- Configure transactional email plus signed delivery events, consent/unsubscribe flows, support destination and retention rules.
- Complete sandbox orders for duplicate requests, stale stock, price changes, payment failure, webhook replay, fraud review, cancellation, refund, fulfillment retries and recovery opt-out.
- Obtain business/legal approval for identity, policies, promotions, privacy, tax nexus, email, refunds and tracking.
- Run desktop, tablet, mobile, keyboard and assistive-technology browser QA. This environment had no browser surface available for that check.
