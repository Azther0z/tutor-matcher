# Shopping Article Template

Use this template for `type: article` pages that compile shopping, buying-list, product-comparison, marketplace-listing, or deal research.

Keep the ordinary article YAML frontmatter from `references/article-template.md`. The `raw` list must include the dedicated 1-to-1 raw file for every ranked candidate.

```md
# {Shopping Category Or Decision}

## Overview

{One short paragraph describing the shopping decision and whether the current recommendations are historical or freshly rechecked.}

## Decision Criteria

- {Category-specific buying rule or priority.}
- {Category-specific buying rule or priority.}

## Candidate Comparison

| Rank | Choice | Price | Risk | Source | {User-chosen column} |
|------|--------|-------|------|--------|----------------------|
| 1 | {Specific listing/product choice} | {Captured price} | {Main risk} | [{Source label}]({choice webpage or raw file}) | {User-chosen value} |

## Rejected Or Conditional Choices

| Choice | Price | Risk | Source | Note |
|--------|-------|------|--------|------|
| {Specific listing/product choice} | {Captured price} | {Main risk} | [{Source label}]({choice webpage or raw file}) | {Why it is rejected or conditional.} |

## Fresh Recheck Before Buying

- {Verify current availability, price, variant, seller terms, condition, or other category-specific blocker.}
- {Verify current availability, price, variant, seller terms, condition, or other category-specific blocker.}

## Recommendation

{Opinionated recommendation with caveats. Say whether it is historical or freshly checked.}

## See Also

- [{Related Article}](related-article.md)
```

## Table Requirements

The Candidate Comparison table must use these required columns in this order: Rank, Choice, Price, Risk, Source, and one user-chosen extra column.

If the user has not specified the extra column, ask what extra column to add before writing or rewriting the table. Do not silently choose the column when the user explicitly reserved that choice.

The Source column links to the choice webpage first. Link to the dedicated raw file only when no webpage URL exists.
