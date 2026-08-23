# Shopping Raw Capture Checklist

Use this checklist when capturing a candidate listing or product page into `raw/`.

## Filename

Choose a descriptive filename without a date. Put the date in YAML frontmatter instead.

Good examples:

```text
raw/storage/facebook-wd-green-2tb-850.md
raw/storage/facebook-wd-purple-2tb-900.md
raw/storage/shopee-seagate-barracuda-2tb-4190.md
```

Avoid date-prefixed candidate filenames such as:

```text
raw/storage/2026-08-02-facebook-wd-green-2tb-850.md
```

If a descriptive filename already exists, append a numeric suffix before `.md`.

## Frontmatter

Use the normal raw frontmatter:

```yaml
---
type: raw
source: <choice webpage URL or null>
collected: YYYY-MM-DD
published: YYYY-MM-DD|null
---
```

## Candidate Capture

Raw evidence must stay faithful to the source. Do not add summaries or recommendations. Capture visible source text and labels as directly as possible.

For shopping candidates, preserve these visible fields when available:

- Title or listing name.
- Price and currency.
- Source platform or shop/seller name.
- Listing URL or product URL in `source` frontmatter.
- Availability, stock, quantity, or sold count.
- Location, ships-from, pickup area, or shipping terms.
- Condition, warranty, return policy, guarantee, or buyer protection.
- Rating, ratings count, reviews, seller signal, response rate, or account age.
- Variant selected or variant ambiguity.
- Product specs that affect the buying decision.
- Visible warnings, conflicting details, defects, health screenshots, or review-risk evidence.

Search-result pages may be captured as context, but each ranked candidate still needs its own dedicated raw file.
