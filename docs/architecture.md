# Commerce architecture and integration contract

## Existing foundation retained

The original vanilla HTML/CSS/JS storefront, Dialashop orange/acid/navy design, department URLs, checkout URL, logo, editorial asset, and private pricing helper remain. The previous demo product array was removed. The site now builds real HTML routes with shared templates rather than rewriting every route to the homepage.

`tools/build.mjs` validates and projects `data/catalog.json`, creates category/subcategory and active product pages, and writes sitemap/robots/security headers. `lib/catalog.js` is the common public catalog contract and shopping logic. `script.js` implements browser interactions. `dist/` contains only public artifacts; never publish the repository root.

## Product boundaries

The authoritative private record lives outside the public site. Import -> validation -> private staging -> explicit public projection -> build/review -> publication. Draft and archived products do not receive pages, listings, offers or sitemap entries. All fields exported to the browser are allowlisted, including variant objects. Future supplier fields remain private by default. Archived product URLs return 404 unless an explicit replacement redirect is added.

`functions/_lib/normalize.js` creates draft records from mapped supplier inputs. `pricing.js` calculates the minimum profitable dollar price using the original category profiles, approved reference pricing, processing costs and margin. Convert approved dollar prices to integer cents for variants; never export the decision inputs. `/api/price` retains its server-side token gate and public-only result.

## API boundary

`functions/api/commerce/[[path]].js` is a Cloudflare Pages router. Without a `COMMERCE` service binding it returns 503 `NOT_CONFIGURED`; it never pretends to charge, register a customer, subscribe an email or create an order. Unknown endpoints return 404. Non-webhook requests reject explicit foreign origins; service responses are uncached. This is an integration boundary, not a complete order backend.

Available adapter paths under `/api/commerce/`:

| Method/path | Service responsibility |
|---|---|
| POST quote | Validate US address, re-read product/variant prices and inventory, get supplier/carrier rates and tax |
| POST checkout | Validate quote, selected shipping method, idempotency key; create durable pending order and Stripe/PayPal hosted payment session |
| POST webhooks/stripe, webhooks/paypal | Verify raw-body signature, deduplicate event, verify payment amount/currency/order, transition order state transactionally |
| POST auth/register, auth/login, auth/logout | Managed identity provider, HttpOnly Secure SameSite cookies, CSRF defenses, rate limiting, verification and recovery |
| GET account, orders | Authenticate and scope every record to the current customer |
| POST tracking | Require order number and matching email or authenticated ownership; return only safe shipment details with enumeration protection |
| POST contact, newsletter | Validate, consent, spam/rate limits, configured delivery provider and retention policy |

The browser currently validates forms locally and reports unavailable services without transmitting personal fields. To activate an integration, implement and deploy the service first, then wire each form to its configured endpoint and add success/error handling. Forms must not infer success from a redirect or from locally generated values.

Suggested quote input: `{items:[{productId,variantId,quantity}], address:{firstName,lastName,email,country,address,address2,city,state,zip}}`. Never accept client prices or totals. Quote output: `{quoteId,expiresAt,items,shippingMethods:[{id,label,amountCents,estimatedDelivery}],subtotalCents,taxCents,currency:'USD'}`. Checkout input: `{quoteId,shippingMethodId,provider:'stripe'|'paypal',idempotencyKey}`. Return a provider-hosted payment URL only after the pending order is durably committed. Whitelist payment redirect destinations.

Use the proposed server-only `docs/schema.sql` as a starting point for products, variants, suppliers, customers, orders, shipments, adjustments, deduplicated payment events and an outbox. It is not applied automatically. Choose the database and identity provider before implementing persistence. Use crypto-random order IDs/numbers with uniqueness constraints. Never use browser order counters, localStorage accounts, raw card fields, or local confirmation pages as proof of payment.

## Payment and fulfillment lifecycle

1. Server revalidates cart, shipping eligibility/rates, tax and inventory. Address format checks do not establish deliverability.
2. Commit pending order and immutable line/address/amount snapshots with an idempotency key. Create hosted Stripe Checkout or the equivalent PayPal approval session with server-only credentials.
3. Verify signed payment webhook, expected amount/currency/order, and event uniqueness. Confirm the payment transactionally.
4. Add supplier forwarding and order email work to the durable outbox. Retry with idempotency; send suppliers only their own line items and necessary shipping information.
5. Ingest inventory and shipment updates from approved suppliers; keep timestamp/freshness checks, carrier, tracking number and fulfillment status. Validate carrier tracking URLs before display.
6. Send shipment notifications via the configured email provider. Cancellations/returns/refunds use authorized server transitions and provider confirmation, with an audit trail.

Supplier accounts, sync jobs, feed credentials, adapters, approval rules and forwarding remain disconnected. No external supplier is contacted by this foundation.

## Launch requirements

Configure verified store origin; approved business identity/contact channels and policy commitments; supplier sources and image rights; private database and administrator/identity access; Stripe/PayPal secrets and webhook verification; actual carrier/shipping and tax integrations; email delivery/consent; inventory jobs and order operations. Secrets belong in Cloudflare/service environment settings, never public build variables or committed files. Apply retention controls and review access boundaries when the real backend is implemented.

Before accepting orders, exercise sandbox end-to-end orders with signed webhook replay, duplicate events, stale inventory, quote expiry, price changes, failed/abandoned payments, mismatched totals, fulfillment retries, authorization and refunds. Run real desktop/tablet/mobile browser and keyboard checks. No supplier, payment, tax, legal, or delivery claims are manufactured by this implementation.
