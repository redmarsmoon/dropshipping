# Product management

The canonical record uses `status` = `draft`, `active`, or `archived`. Keep full records in ignored `private/products.json` or a future private database. `data/catalog.json` is a public projection, never private storage.

Required for all records: unique `id`, `sku`, `slug` and a valid `status`. Slugs use lowercase letters, digits and hyphens.

For active products also provide:

| Field | Format |
|---|---|
| name, description | Plain text; no HTML |
| category | Department slug from `data/categories.json` |
| subcategory | Slug of a child category name |
| brand, condition | Real product details |
| currency | USD |
| images | Array of HTTPS URLs or paths under `/assets/` with image rights verified |
| variants | At least one; each has unique id, SKU, options object, integer priceCents, availability |
| variant availability | in_stock, out_of_stock, unknown |
| variant compareAtCents | Optional genuine reference price above selling price |
| variant image | Optional safe image URL |
| shipping | Approved product-specific shipping details and estimate |
| returnPolicy | Approved product-specific eligibility and terms |
| seoTitle, seoDescription | Unique product search metadata |

Optional public fields: features (text array), specifications (plain text key/value object), weight (value with units), dimensions (value with units or object), relatedIds (product IDs), tags (text array), dateAdded (ISO timestamp), featured (boolean), bestSeller (boolean based on genuine sales), clearance (boolean based on approved merchandising).

Private fields can include supplierId, supplierProductId, supplierSku, supplierCost, sourcing references and minimumMargin. The exporter explicitly selects public fields and variant fields; other keys are omitted. Keep private data out of public text, options, specifications and images. Never store API keys in records.

For a single-option product, provide one variant with `options: {}`. For multi-option products, each variant describes one complete combination, such as size/color/style. Cart identity is product ID plus variant ID; prices and images come from the selected variant. All option-dependent filters must match a single variant.

JSON import is a complete replacement batch. Add/edit by updating records; archive with status `archived`; remove by omitting the record. CSV/XML and API feeds should be converted by approved source adapters into this schema and imported as drafts. There is no unauthenticated web admin panel.

Publication review must confirm sourcing approval, image rights, legitimate compare-at pricing, inventory freshness, shipping eligibility, approved returns, and product accuracy. Build validation checks structure; it cannot establish these facts.

Rebuild after exporting. The homepage populates Featured and Best sellers only when their flags are set, and New arrivals from active products sorted by date. Product URLs are generated at build time, so adding records requires no page redesign. No sample products are shipped.
