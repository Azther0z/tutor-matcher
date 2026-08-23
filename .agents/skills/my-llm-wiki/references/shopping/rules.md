# Shopping Mode Rules

Use these rules when a wiki is being used for buying-list research, product comparison, marketplace listings, deal research, or purchase decisions.

## Scope

- Keep normal wiki page types. Do not introduce `type: shopping`.
- Use shopping mode as an opt-in layer over Ingest, Query, Archive, and Lint.
- Apply these rules forward-only. Do not migrate existing pages unless the user asks.
- Treat each candidate as a specific listing or product page, not an abstract product family, unless the user explicitly asks for model-level research.
- Agents may research, compare, rank, and draft recheck questions. Do not message sellers, place orders, negotiate, or imply purchase commitment without explicit user instruction.

## Volatile Listing Rule

Marketplace and retailer listings are historical snapshots once captured. A listing's price, availability, stock, shipping, warranty, seller condition, and page contents may have changed after collection.

- Say "captured at" or "captured on" when using old listing evidence.
- Do not say a listing is currently available unless it was freshly rechecked in the current task.
- If the user asks what to buy now, either perform fresh research/rechecks or clearly label the answer as a historical recommendation.
- Every buy recommendation based on listing evidence should include what to recheck before purchase.

## Candidate Evidence

Each ranked candidate choice must have a dedicated 1-to-1 raw `.md` evidence file.

- Use descriptive raw filenames without dates, for example `raw/storage/facebook-wd-green-2tb-850.md`.
- Keep the collection date in YAML frontmatter as `collected: YYYY-MM-DD`.
- Search-result raw files are allowed as context, but they do not satisfy the candidate evidence requirement.
- Do not rank a candidate from a broad search-results page unless that candidate also has its own dedicated raw capture.
- If several variants share one product URL but represent distinct choices, capture the selected variant clearly in the dedicated raw file.

## Candidate Comparison Table

Shopping article candidate tables require exactly these first columns, in this order:

```md
| Rank | Choice | Price | Risk | Source | {User-chosen column} |
|------|--------|-------|------|--------|----------------------|
```

Column rules:

- `Rank`: opinionated ordering, using category-specific buying rules.
- `Choice`: the specific listing or product choice.
- `Price`: captured price in the relevant local currency when known.
- `Risk`: the most important downside, uncertainty, or blocker.
- `Source`: clickable Markdown link to the choice webpage first, if available; otherwise link to the dedicated raw file.
- `{User-chosen column}`: ask the user at use-time if they have not specified it.

When asking for the user-chosen column, offer examples such as `Recheck`, `Condition`, `Why`, `Availability At Capture`, `Warranty / Return`, and `Seller Signal`, but do not silently choose one when the user explicitly wants to decide.

## Recommendations

- Be opinionated: pick a winner when evidence supports it.
- Use category-specific buying rules instead of a global weighted score.
- Include caveats for stale evidence, uncertain variants, seller risk, warranty/return limitations, and conflicting page details.
- Keep rejected and conditional candidates visible when they explain why the shortlist winner is better.
- Prefer practical buy/no-buy thresholds over fake precision.

## Shopping Lint Judgment

When linting a shopping wiki, report these issues without auto-fixing facts:

- Candidate comparison rows missing Rank, Choice, Price, Risk, Source, or the user-chosen extra column.
- Ranked candidates without a dedicated 1-to-1 raw evidence file.
- Candidate Source links that point to raw files even though the raw frontmatter has a webpage URL.
- Active-sounding recommendations based only on historical listing captures.
- Buy recommendations without a recheck-before-buying note.
- Shopping articles without category-specific decision criteria or buying rules.
