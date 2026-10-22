# News Implementation Plan

**Goal:** Deliver a working, bilingual `/news` page with real F1 RSS headlines, source attribution, filtering, refresh, and independent source failure handling.

**Architecture:** For this first release, use two fixed same-origin RSS proxy routes (Motorsport F1, FIA press releases), with five-minute CDN and client caches. This deliberately avoids requiring a new database, service credential, or unpublished migration before the page works. Browser XML parsing returns only plain-text titles, original links and dates; no external HTML, images, article bodies, translation service, or third-party scripts are rendered. News API, reusable hook, shared types and pure transformations remain separate. Social selections have an explicit empty state until editorial content is available. Ingestion to Supabase remains a later option.

**Tech Stack:** React 18, TypeScript, native DOMParser / fetch, Vite / Vercel rewrites, Zustand time-zone preference, Vitest and Playwright.

## Contract and design brief

- Fixed routes: `GET /news-feed/motorsport`, `GET /news-feed/fia`; response is upstream RSS XML, not arbitrary URL forwarding. Vite dev/preview and production implement the same mapping.
- News item: `id`, `sourceId`, `kind` (`news` / `official` / `social`), `title`, `url`, `publishedAt` (ISO timestamp). No sensitive or author account data is required.
- Source status: `ready` / `stale` / `error`, with nullable last successful fetch time. A valid empty RSS is different from an invalid document or HTTP error. Missing dates and unsafe links are omitted.
- Result: items sorted newest first and deduplicated by canonical URL, plus per-source status. Existing source cache is retained when that source fails on refresh.
- Audience / main task: visitors scanning current F1 headlines and opening the original source; latest news is independent of the season selector.
- Layout: editorial masthead, category and source filters, one prominent latest headline, compact subsequent headlines, source-status rail. Native links and controls, visible focus, responsive single column on mobile.
- Reuse design tokens and product masthead. No charts or new fonts. Chinese / English UI, source headlines kept in their original language; publication and retrieval times use the existing time-zone setting.
- Loading, valid empty feed, no filtered matches, no social selections, partial source failure, full failure and stale cached content each receive specific states and recovery controls.
- Source reuse conditions remain as recorded in the source audit. The implementation indexes source headlines and links; it does not claim that an RSS endpoint grants rights to republish full text, images or translations.

## Implementation and verification

1. Add failing tests for canonical links, unsafe URLs, title/date validation, ordering and deduplication; API partial failures and last-good caches; `/news` preload mapping; fixed production RSS routes.
2. Add `src/types/news.ts`, `src/data/newsSources.ts`, `src/utils/news.ts`, `src/api/news.ts` and `src/hooks/useNews.ts`. Validate real XML in browser tests, including HTML masquerading as RSS and external markup in titles.
3. Add News page / stylesheet, lazy route, navigation and translation keys. Keep the route available to guests under the existing site-access policy.
4. Configure exact RSS routes in Vite dev / preview, Vercel and the local built-app QA server; unknown feed paths return 404. Update source version from 1.1.0 to 1.2.0 (`feat`) and package lock consistently, without committing or deploying.
5. Run targeted tests, full unit suite, strict lint, encoding checks and production build. Run browser tests on desktop, tablet and mobile for filters, external links, source failures, refresh, language/time-zone behavior and overflow; capture screenshots and check console/network failures.
6. Smoke-check the project's required routes using existing QA fixtures, and perform a live feed request through the same-origin development proxy. Record limitations, screenshots and fresh validation results in a browser QA report.

Live integration adjustment: Autosport returns 405 to the Node service although the earlier Python probe returned XML. It is not enabled in this release. Motorsport and FIA were verified through the application proxy; source availability is environment-dependent.
