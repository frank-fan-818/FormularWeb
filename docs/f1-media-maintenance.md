# F1 Driver and Constructor Media

The application serves driver headshots and constructor logos only from `public/images`. Runtime pages do not hotlink third-party media.

## Source of truth

- `src/data/f1-media-manifest.json` maps API IDs and aliases to local files.
- `scripts/f1-media-sources.json` contains approved manual source overrides for assets that current discovery cannot resolve.
- OpenF1's latest drivers endpoint supplies current Formula 1 headshot URLs.
- Formula 1 team pages/CDN supply the curated Audi and Cadillac logos.

Formula 1 names, logos, photography, and related marks remain the property of their respective owners. OpenF1 is an unofficial data service and is not affiliated with Formula 1. Review usage rights before redistributing media outside this project.

## Commands

```text
npm run media:check
npm run media:discover
npm run media:sync
```

- `media:check` is offline and deterministic. It validates manifest IDs, safe filenames, missing files, true file formats, minimum size, and duplicate driver images. It runs in CI and `quality:check`.
- `media:discover` compares the live Jolpica standings roster with the manifest without changing files. A weekly read-only GitHub Actions workflow runs it so new IDs become visible failures.
- `media:sync` discovers headshots through OpenF1, applies approved overrides, downloads assets atomically, validates MIME/signatures, and finishes with the offline audit.

## Adding a new driver or constructor

1. Run `npm run media:discover` and note the unknown IDs.
2. Add canonical entries and API aliases to `src/data/f1-media-manifest.json`.
3. If discovery does not expose an approved source, add an explicit URL to `scripts/f1-media-sources.json`.
4. Run `npm run media:sync`.
5. Inspect the new images and run `npm run media:check`.

Until an asset is curated, the React components derive readable initials/monograms from the entity name or ID. New roster data therefore remains usable instead of showing a broken image or `?`.
