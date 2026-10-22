# News reader implementation plan

**Goal:** Open news inside the website as a short, attributed RSS introduction, with an optional original-source link.

**Architecture:** Add a required plain-text `summary` field to the existing news item contract. Extract only a bounded short introduction from RSS description; never fetch article bodies or render publisher HTML. Link to `/news/read?source=...&article=...`, where the article is a validated canonical URL matched against the existing feed result, not an arbitrary fetch target. The reader loads independently on refresh and distinguishes missing introductions, items no longer in the feed, source errors, stale cached items and malformed links.

**Product brief:** Readers should understand the headline and short introduction without leaving the site. Reuse typography, colors, spacing and source-time presentation from the news page, with a narrow reading column and a clear “source summary, not full article” label. Keep a visible return link and optional original link. Mobile should prioritize headline and introduction, with no overlapping controls. Source language is retained; this is not AI translation or an original report.

**Contract:** `NewsItem.summary: string` (empty when missing), maximum 280 Unicode code points and 40 whitespace-delimited words plus a truncation marker. Only the RSS introduction is used; FIA descriptions containing long releases are shortened. Original URLs must pass the existing source allowlist; unknown sources and unsafe URLs cannot create source links or cause external requests. No upstream API paths or authentication rules change.

1. Add failing tests for plain-text excerpt extraction, entities, scripts/media removal, limits, missing descriptions, source-validated reader URLs, and route preloading.
2. Implement summary extraction in `src/utils/news.ts`, extend shared news types, and add a reader request-selection hook in `src/hooks/`. Preserve the existing news API cache and failure handling.
3. Add the lazy reader page, internal title / reading links, source attribution, original link and bilingual empty / error states. Keep the news navigation active on the reader route.
4. Extend browser QA for same-tab navigation, direct refresh, return navigation, missing / malformed links, absent summaries and hostile markup; verify time zone and responsive layouts.
5. Run targeted tests, the complete unit suite, strict lint, encoding checks and production build, then desktop / tablet / mobile browser QA. Refresh the local production preview and show the reader in the user's existing tab.

This continues the same unpublished news feature prepared as version 1.2.0; no extra version bump, commit, push or deployment is needed for this iteration.
