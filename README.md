# Dialashop

Dialashop is a static-first, deal-focused dropshipping marketplace storefront for US customers. The current catalog is explicitly development-only: prices, availability, payments, order submission, and email delivery stay disabled until verified services are connected.

## Run locally

Serve the repository root with any static server (opening `index.html` directly also works for the homepage).

```powershell
python -m http.server 4173
```

Then open `http://localhost:4173/`.

## Current features

- Original Dialashop branding and responsive deal-marketplace UI
- Search across preview names, brands, categories, SKUs, tags, and features
- Department and condition filtering with safely disabled price sorting
- Reusable product card and deal-event presentation
- Quantity-aware `localStorage` preview cart
- US-ready checkout form with payments disabled until integration
- Organization metadata, canonical URL, robots.txt, sitemap, and semantic headings
- Server-only supplier normalization and competitive pricing modules for Cloudflare Pages Functions

## Data boundaries

`script.js` contains public development preview records only. It intentionally excludes supplier cost, supplier identity, margins, internal pricing rules, credentials, and fake availability. Server-only modules live in `functions/_lib/` and are not bundled into the storefront.

The future product flow is:

`Supplier API / CSV / XML / JSON / manual input -> normalization -> private product record -> pricing decision -> public storefront projection`

## Production integrations still required

- Approved supplier APIs/feeds and product-image rights
- Inventory and price refresh jobs
- Competitor pricing from authorized feeds or manual inputs (no scraper is included)
- Secure product/order database and administrator authentication
- Payment processor, shipping rates, tax, fraud checks, and order confirmation
- Supplier order submission, tracking ingestion, returns, customer accounts, and email provider

See [docs/architecture.md](docs/architecture.md) for schemas, pricing rules, deal events, route plan, and go-live gates.
