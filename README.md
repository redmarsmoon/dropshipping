# Dialashop

Dialashop is a static-first US store foundation built on the original HTML/CSS/JavaScript design and Cloudflare Pages Functions. The public catalog is empty. No payments, orders, accounts, or supplier services are simulated.

## Develop and deploy

Requires Node 24+ and Python for the optional public-site server. No npm packages are required.

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run preview
```

Open http://localhost:4173. On systems without the PowerShell execution-policy restriction, `npm` works in place of `npm.cmd`.

**Publish `dist/` only.** Configure Cloudflare Pages build command `npm run build`, output `dist`, and retain the root `functions/` directory for API functions. Never serve the repository root: it contains internal documentation and may contain ignored private imports. Other static hosts can serve `dist`, but need separate API hosting. No SPA rewrite is needed; pages have real HTML files. Unknown and removed products receive the host's 404 page.

Set build variable `SITE_URL` to the verified HTTPS store origin; default retains the existing `https://dialashop.com` canonical URLs. Existing `/deals/`, department, `/clearance/`, and `/checkout/` URLs are retained. Root `index.html`, `checkout/index.html`, sitemap and robots are retained generated snapshots; edit `tools/build.mjs` and rebuild, rather than editing snapshots.

## Product management

1. Prepare a JSON array using [docs/product-management.md](docs/product-management.md). Do not put credentials in it.
2. `npm.cmd run catalog -- import C:\path\approved-products.json` validates the full batch and stores it in ignored `private/products.json`.
3. Edit this private file to add, change, archive, or remove products. Keep unapproved items `draft`. Re-import to validate a replacement batch.
4. `npm.cmd run catalog -- export` writes only explicitly allowed public fields to `data/catalog.json`.
5. `npm.cmd run build` validates category membership, uniqueness, URLs, active variants and required product information. `npm.cmd test` verifies the foundation.
6. Review and deploy `dist/`. Each active product gets its own HTML page and sitemap entry. Draft/archived products have no page. Configure a specific redirect if a removed product has a replacement.

`functions/_lib/normalize.js` supports mapped supplier records as drafts; `pricing.js` retains the original server-only margin calculator. Publish cents-based variant prices only after approval. Do not put supplier cost, reference URLs, or margins into public descriptions/specifications.

## Implemented

- 51 generated pages with no products: home, shop, legacy deals, departments, subcategories, search, cart, checkout, wishlist, account/login/register/order history, tracking, confirmation, about/help/contact and policy information.
- Product templates with gallery, variant-specific image/SKU/price/availability, quantity, cart, buy now, related products, and an empty genuine-review section.
- Real-data keyword, category/subcategory, brand, variant, availability, price filters, sorting, and load more. Product collections populate from approved product flags and dates.
- Browser-local cart/wishlist with storage error handling, stale item reconciliation and cross-tab updates. Monetary math uses integer cents.
- Guest address form with US state, ZIP and required-field format checks; no address verification service is connected. No form sends personal information to an unconfigured service.
- Static page metadata, canonicals, Open Graph, breadcrumbs, product offers only with actual catalog data, sitemap, robots, 404 and security headers.
- Private Node/SQLite operations service with staff roles, product/category/supplier management, CSV imports, pricing approvals, inventory updates, orders, returns, tickets, promotions, shipping rules, reporting, audit records and notification outbox.
- Consent preferences, UTM capture after consent, related/accessory/cart recommendations, empty real-data Google and Meta feeds, returns and support foundations.

## Not live yet

The private operations foundation is functional locally, but production authentication, payment, tax, address deliverability, email, supplier feeds/forwarding, carrier tracking, contact/newsletter delivery, live chat and reviews need configured services. Policy pages contain truthful preparation information; they are not approved operational policies. See [docs/operations.md](docs/operations.md), [docs/architecture.md](docs/architecture.md), and [docs/implementation-report.md](docs/implementation-report.md).

## GitHub Pages deployment

The existing public hosting target is https://redmarsmoon.github.io/dropshipping/. `npm.cmd run deploy` tests the foundation, obtains the Pages URL, builds with that `SITE_URL`, pushes only `dist/` to `gh-pages`, and configures Pages to publish that branch. Source changes are pushed separately to `main`. Builds support a repository subpath for navigation, JavaScript modules, public images and assets. GitHub Pages does not run Cloudflare Functions; those integration endpoints still require separate hosting. To use a custom domain later, configure it in Pages and the deploy command will use the configured URL.
