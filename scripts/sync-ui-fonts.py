"""Update only changed Chinese subsets from the pinned build-only font source."""
import hashlib
import io
import json
from pathlib import Path
import re
import sys

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'public' / 'fonts'
SPEC = json.load(sys.stdin)
MANIFEST_PATH = DEST / 'manifest.json'
manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
source_path = ROOT / 'scripts' / 'font-sources' / 'IBMPlexSansSC-Regular.woff2'
source = source_path.read_bytes()
available = set(TTFont(io.BytesIO(source)).getBestCmap())
ui = set(SPEC['uiCodepoints'])
core = set(SPEC['coreCodepoints'])
titles = set(SPEC['accountTitleCodepoints'])
# Legacy manifests did not record the login/core partition.
core |= set(TTFont(DEST / 'F1UIHanzi-400-core.woff2').getBestCmap())
ui |= core | titles
missing = ui - available
if missing:
    raise ValueError('Pinned source lacks ' + ', '.join(f'U+{point:04X}' for point in sorted(missing)))


def ranges(points):
    groups = []
    for point in sorted(points):
        if groups and point == groups[-1][1] + 1:
            groups[-1][1] = point
        else:
            groups.append([point, point])
    return ','.join(f'U+{first:X}' + (f'-{last:X}' if first != last else '') for first, last in groups)


updates = {}
css = (ROOT / 'src' / 'styles' / 'fonts.css').read_text(encoding='utf-8')
for filename, family, points in [
    ('F1UIHanzi-400-core.woff2', 'F1 UI Hanzi', core),
    ('F1UIHanzi-400-extended.woff2', 'F1 UI Hanzi', ui - core),
    ('F1UIAccountTitle-400.woff2', 'F1 UI Account Title', titles),
]:
    existing = (DEST / filename).read_bytes()
    if set(TTFont(io.BytesIO(existing)).getBestCmap()) == points:
        data = existing
    else:
        font = TTFont(io.BytesIO(source), recalcTimestamp=False)
        options = subset.Options()
        options.flavor = 'woff2'
        options.name_IDs = ['*']
        options.ignore_missing_unicodes = False
        subsetter = subset.Subsetter(options=options)
        subsetter.populate(unicodes=points)
        subsetter.subset(font)
        names = {1: family, 3: family.replace(' ', '') + '-400', 4: family + ' Regular',
                 6: family.replace(' ', '') + '-Regular', 16: family, 17: 'Regular'}
        for record in font['name'].names:
            if record.nameID in names:
                record.string = names[record.nameID].encode(record.getEncoding())
        output = io.BytesIO()
        font.save(output)
        data = output.getvalue()
        if set(TTFont(io.BytesIO(data)).getBestCmap()) != points:
            raise ValueError('Generated cmap does not match requested glyphs: ' + filename)
    updates[filename] = data
    face = (f"@font-face {{ font-family: '{family}'; font-style: normal; font-weight: 400; "
            f"font-display: optional; src: url('/fonts/{filename}') format('woff2'); unicode-range: {ranges(points)}; }}")
    pattern = r"@font-face\s*\{[^}]*url\('/fonts/" + re.escape(filename) + r"'\)[^}]*\}"
    css, replacements = re.subn(pattern, lambda _match: face, css)
    if replacements != 1:
        raise ValueError('Expected one declared font face: ' + filename)

for asset in manifest['assets']:
    if asset['file'] in updates:
        data = updates[asset['file']]
        asset.update(bytes=len(data), sha256=hashlib.sha256(data).hexdigest())
manifest.update(uiCodepoints=sorted(ui), coreCodepoints=sorted(core), accountTitleCodepoints=sorted(titles))
# All cmap and CSS checks complete before replacing generated files.
for filename, data in updates.items():
    if data != (DEST / filename).read_bytes():
        (DEST / filename).write_bytes(data)
(ROOT / 'src' / 'styles' / 'fonts.css').write_text(css, encoding='utf-8')
MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'UI fonts synchronized: {len(ui)} glyphs, {len(core)} account/core glyphs; actual cmap verified.')
