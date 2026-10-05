# Self-hosted UI fonts

The UI uses subsets of official [IBM Plex](https://github.com/IBM/plex) Sans,
Sans Condensed, Mono and Sans SC fonts. Derived families are named `F1 UI Sans`,
`F1 UI Display`, `F1 UI Mono` and `F1 UI Hanzi` to respect the OFL reserved names.
The original licenses are shipped in `public/fonts/`.

ASCII weight files and Chinese account-entry/extended glyph subsets are requested only
when used. The regular/bold Sans pair avoids an extra semibold first-view download.
ASCII files keep outlines, kerning and ligatures while dropping legacy TrueType
grid programs; Chinese files retain their original hinting. The eight generated
files total approximately 118 KiB and are not all requested at startup.
Chinese glyphs share the regular file across weights, with browser weight synthesis;
transient loading labels use system fonts instead of initiating extra brand-font requests.
A separate 4 KiB account-title subset is preloaded to make the first heading
independent of the larger Chinese body font; title-copy coverage has its own gate.
Accented remote names use the system fallback. `font-display: optional` keeps text visible and prevents a late font
swap on slow connections. Content outside the UI subset uses explicit system
fallbacks. This does not claim identical system fallback rendering for arbitrary
remote names or languages.

`public/fonts/manifest.json` records source versions, glyph coverage, file sizes
and SHA-256 hashes. `npm run fonts:verify` checks source UI glyphs, asset hashes,
WOFF2 headers, same-origin delivery and the bundled OFL licenses. Run it after
copy changes. New Chinese glyphs require regeneration; do not bypass the gate.

Regeneration requires Python with fontTools 4.51.0 and Brotli. Download the
official packages to `.cache/release-fonts/` without installing their scripts:

```powershell
New-Item -ItemType Directory -Path .cache/release-fonts -Force | Out-Null
npm pack @ibm/plex-sans@1.1.0 @ibm/plex-sans-condensed@2.0.0 @ibm/plex-mono@2.5.0 @ibm/plex-sans-sc@1.1.0 --pack-destination .cache/release-fonts --ignore-scripts
python scripts/build-ui-fonts.py
npm run fonts:verify
```

Commit the generated WOFF2 files, CSS, licenses and manifest together. The npm
archives remain local and ignored. Browser QA must check cold and cached loads,
offline fallback, long labels, both themes and font request failures.
