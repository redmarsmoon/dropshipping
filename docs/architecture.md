# Dialashop commerce architecture

## Product model

The canonical private product record supports identity (`id`, `sku`, `supplierSku`, `supplierId`, `supplier`, `supplierProductId`), merchandising (`name`, `slug`, `brand`, `department`, `category`, `subcategory`, `description`, `shortDescription`, `features`, `specifications`, `images`, `thumbnail`), pricing (`supplierCost`, `normalRetailPrice`, `competitorPrice`, `wootComparablePrice`, `dialashopPrice`, `compareAtPrice`, `discountPercentage`, `minimumMargin`, `currency`, `lastPriceCheck`), commerce (`condition`, `stockStatus`, `stockQuantity`, `variants`, `size`, `color`, `style`, `weight`, `dimensions`), fulfillment (`shippingOrigin`, `shippingRegions`, `shippingCost`, `handlingTime`, `estimatedDelivery`, `supplierUrl`, `sourceReference`), discovery (`tags`, `dealEvent`, `dateAdded`, `dealStart`, `dealEnd`), and SEO (`seoTitle`, `seoDescription`, `canonicalUrl`).

Private pricing and supplier fields remain in server-side storage. The browser receives only a public projection. No supplier credentials belong in product records.

## Supplier normalization

`functions/_lib/normalize.js` accepts mapped records from approved API, CSV, XML, JSON, or manual sources and converts them to the canonical schema. Every source needs its own adapter configuration. Unknown conditions are rejected rather than guessed.

## Pricing

`functions/_lib/pricing.js` uses category-specific margin profiles and calculates a minimum profitable price that includes supplier cost, shipping, payment processing, technology cost, and required margin. It compares that floor with authorized competitor data, any manually supplied comparable-deal price, and a legitimate normal retail price.

The engine never prices below its profitable floor. If the floor is above the defensible market ceiling, the record is flagged for review instead of published. Savings are generated only when a positive, verified reference price is greater than the final selling price.

The Cloudflare handler in `functions/api/price.js` is inactive until `PRICING_API_TOKEN` is configured. Its response omits supplier cost, margins, and internal rule details.

## Deal events

An event has `id`, `name`, `slug`, `banner`, `shortDescription`, `productIds`, `startDate`, `endDate`, `category`, `seoTitle`, `seoDescription`, and `canonicalUrl`. A product can reference zero or more event IDs. Countdown UI may render only when a valid future `endDate` is present.

## Public routes

Target routes are `/deals/`, department slugs, `/brands/`, `/brand/{slug}/`, `/product/{slug}/`, `/deals/{event-slug}/`, `/cart/`, and `/checkout/`. Filter, sort, search, and variant states should be non-indexable UI state or canonicalize to their parent page. Product and event pages should be generated at build time only from publishable records.

## Go-live gates

A record may be published only when its supplier is approved, rights-cleared images are present, price and stock timestamps are current, condition is explicit, shipping is supported for the destination, and the pricing decision is publishable. Checkout requires a payment processor and order backend; supplier submission starts only after confirmed payment.
