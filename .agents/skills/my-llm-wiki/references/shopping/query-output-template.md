# Shopping Query Output Template

Use this structure when answering shopping-mode queries in the conversation or archiving a shopping answer.

## Historical Caveat

Start by stating whether the recommendation is based on historical wiki captures or fresh research from the current task.

Example:

```md
This is based on historical listing captures in the wiki. Recheck price, availability, variant, and seller terms before buying.
```

## Ranked Shortlist

Give the recommendation first.

```md
1. {Choice} - {Price}. {Why it ranks first.} Recheck: {main recheck item}.
2. {Choice} - {Price}. {Why it ranks second.} Recheck: {main recheck item}.
3. {Choice} - {Price}. {Why it ranks third.} Recheck: {main recheck item}.
```

## Comparison Table

Use the required shopping table columns:

```md
| Rank | Choice | Price | Risk | Source | {User-chosen column} |
|------|--------|-------|------|--------|----------------------|
```

If the user has not specified the extra column and the answer needs a comparison table, ask for the column before finalizing the table. Do not invent the extra column.

The Source column links to the choice webpage first. Link to the dedicated raw file only when no webpage URL exists.

## Recheck Before Buying

List the concrete checks needed before acting:

- Current availability.
- Current price and selected variant.
- Shipping/pickup feasibility.
- Condition, health evidence, warranty, or return terms.
- Any category-specific blocker.

## Recommendation Style

Be opinionated with caveats. Avoid fake precision. Use category-specific buying rules from the relevant article when available.
