# Build-only Chinese font source

`IBMPlexSansSC-Regular.woff2` is the unmodified complete, hinted regular font
from the official `@ibm/plex-sans-sc@1.1.0` npm archive. Its OFL license is in
`LICENSE.txt`; `manifest.json` records its exact bytes and SHA-256.

This directory is outside `public/` and is not imported by application code.
The complete font is only used to generate the small existing UI subsets.
It is never copied to the production bundle. Keeping it in the repository
avoids a 114 MiB package download whenever one new Chinese character appears.

`npm run fonts:sync` only invokes Python when required UI/account glyphs are
missing. It uses fontTools 4.51.0 and Brotli 1.2.0, installed from hash-locked
PyPI wheels in `.cache/ui-font-tools` if necessary. Set `PYTHON` to a Python
3.10+ executable if it is not on PATH. Compatible Python wheel hashes for
3.10–3.14 are committed in `scripts/ui-fonts-requirements.lock`.

Original package: <https://www.npmjs.com/package/@ibm/plex-sans-sc/v/1.1.0>.
