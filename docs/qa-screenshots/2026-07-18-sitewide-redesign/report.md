# Sitewide Redesign Browser QA Report

- Date: 2026-07-18
- Branch: `main`
- Build or dev URL: `http://127.0.0.1:5175`
- Routes checked: `/`, `/seasons`, `/races`, `/races/1/results`, `/drivers`, `/drivers/max_verstappen`, `/constructors`, `/constructors/red_bull`, `/circuits`, `/circuits/austin`, `/settings`, `/login`
- Viewports checked: 1440x900, 768x1024, 375x812
- Findings: All checked routes returned HTTP 200 with no document-level horizontal overflow or page runtime errors. The first pass found a React `fetchPriority` warning, a clipped mobile driver name, a clipped mobile constructor masthead, and a hidden mobile circuit map; all four were fixed and the affected routes were rechecked. Expected internally scrolling chart canvases remain contained on mobile.
- Console/network: Final affected-route checks reported no console errors and no failed requests. The initial complete pass also reported no failed requests.
- Blocking: None.
- Screenshot paths: `docs/qa-screenshots/2026-07-18-sitewide-redesign/*.png`

## Visual review

- Home and Seasons present the current season answer before supporting tables.
- Races separates now/next, future rounds, and completed rounds without duplicate entries.
- Driver and constructor indexes preserve team identity while fitting at 375px.
- Driver and constructor dossiers keep names, avatars/logos, ranks, and current metrics visible without clipping.
- Circuit index and detail surfaces prioritize track geometry; the sector map remains visible on mobile.
- Login and Settings use restrained utility layouts and remain touch-safe on mobile.
