"""Build self-hosted fonts from pinned official IBM npm archives. No network calls."""
import hashlib
import io
import json
from pathlib import Path
import re
import tarfile

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'public' / 'fonts'
DEST.mkdir(parents=True, exist_ok=True)
ASSETS = []
CSS = []


def face(family, filename, weight, ranges=''):
    CSS.append(f"@font-face {{ font-family: '{family}'; font-style: normal; font-weight: {weight}; "
               f"font-display: optional; src: url('/fonts/{filename}') format('woff2'); "
               f"{('unicode-range: ' + ranges + ';') if ranges else ''} }}")


def save(name, data):
    (DEST / name).write_bytes(data)
    ASSETS.append({'file': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})


def characters(text):
    text += ''.join(chr(int(code, 16)) for code in re.findall(r'\\u([0-9a-fA-F]{4})', text))
    return {ord(char) for char in text if '\u2e80' <= char <= '\u9fff' or '\uff00' <= char <= '\uffef'}


def ranges(points):
    result = []
    for point in sorted(points):
        if result and point == result[-1][1] + 1:
            result[-1][1] = point
        else:
            result.append([point, point])
    return ','.join(f'U+{start:X}' + (f'-{end:X}' if end != start else '') for start, end in result)


core_names = {'Login.tsx', 'AuthShell.tsx', 'AuthCard.tsx', 'AccessGate.tsx'}
all_chars, core_chars = set(), set()
for source in (ROOT / 'src').rglob('*'):
    if source.suffix not in {'.ts', '.tsx', '.json'} or '.test.' in source.name:
        continue
    found = characters(source.read_text(encoding='utf-8'))
    all_chars |= found
    if source.name in core_names:
        core_chars |= found
all_chars |= characters('，。？！：；（）【】·—…中文数据当前赛季车手车队赛道首页设置登录')
core_chars |= characters('，。？！：；（）【】·—…中文数据当前赛季车手车队赛道首页设置登录')
translations = json.loads((ROOT / 'src' / 'locales' / 'zh-CN.json').read_text(encoding='utf-8'))
for source in (ROOT / 'src').rglob('*.tsx'):
    if source.name in core_names:
        for key in re.findall(r"\bt\(['\"]([^'\"]+)['\"]", source.read_text(encoding='utf-8')):
            core_chars |= characters(translations.get(key, ''))

account_titles = []
for name in ['Register.tsx', 'ForgotPassword.tsx', 'ResetPassword.tsx']:
    account_titles += re.findall(r'title="([^"]+)"', (ROOT / 'src' / 'pages' / name).read_text(encoding='utf-8'))
login_source = (ROOT / 'src' / 'pages' / 'Login.tsx').read_text(encoding='utf-8')
for matched in re.findall(r"title=\{session \? '([^']+)' : '([^']+)'\}", login_source):
    account_titles.extend(matched)
headline_points = characters(''.join(account_titles))
core_chars |= headline_points

packages = [('sans', '1.1.0', 'IBMPlexSans', 'F1 UI Sans', [400, 700]),
            ('sans-condensed', '2.0.0', 'IBMPlexSansCondensed', 'F1 UI Display', [700]),
            ('mono', '2.5.0', 'IBMPlexMono', 'F1 UI Mono', [500, 700])]
weight_names = {400: 'Regular', 500: 'Medium', 600: 'SemiBold', 700: 'Bold'}

def rename(font, family, weight):
    names = {1: family, 3: f'{family.replace(" ", "")}-{weight}',
             4: f'{family} {weight_names[weight]}', 6: f'{family.replace(" ", "")}-{weight_names[weight]}',
             16: family, 17: weight_names[weight]}
    for record in font['name'].names:
        if record.nameID in names:
            record.string = names[record.nameID].encode(record.getEncoding())

for package, version, prefix, family, weights in packages:
    with tarfile.open(ROOT / '.cache' / 'release-fonts' / f'ibm-plex-{package}-{version}.tgz') as archive:
        (DEST / f'LICENSE-plex-{package}.txt').write_bytes(archive.extractfile('package/LICENSE.txt').read())
        for weight in weights:
            filename = f'{prefix}-{weight_names[weight]}-Latin1.woff2'
            font = TTFont(io.BytesIO(archive.extractfile(f'package/fonts/split/woff2/{filename}').read()))
            options = subset.Options()
            options.flavor = 'woff2'
            options.name_IDs = ['*']
            # Modern browser rasterizers handle the ASCII outlines directly;
            # keep kerning/ligatures and drop legacy TrueType grid programs.
            options.hinting = False
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=range(0x20, 0x7f))
            subsetter.subset(font)
            rename(font, family, weight)
            output = io.BytesIO()
            font.save(output)
            filename = f'{family.replace(" ", "")}-{weight}.woff2'
            save(filename, output.getvalue())
            face(family, filename, weight, 'U+20-7E')

with tarfile.open(ROOT / '.cache' / 'release-fonts' / 'ibm-plex-sans-sc-1.1.0.tgz') as archive:
    (DEST / 'LICENSE-plex-sans-sc.txt').write_bytes(archive.extractfile('package/LICENSE.txt').read())
    for weight in [400]:
        data = archive.extractfile(f'package/fonts/complete/woff2/hinted/IBMPlexSansSC-{weight_names[weight]}.woff2').read()
        for partition, points in [('core', core_chars), ('extended', all_chars - core_chars)]:
            font = TTFont(io.BytesIO(data))
            available = set(font.getBestCmap())
            missing = points - available
            if missing:
                raise ValueError(f'Missing UI glyphs: {sorted(missing)}')
            options = subset.Options()
            options.flavor = 'woff2'
            options.name_IDs = ['*']
            subsetter = subset.Subsetter(options=options)
            subsetter.populate(unicodes=points)
            subsetter.subset(font)
            # OFL reserved names: derived subsets use their own family/name.
            rename(font, 'F1 UI Hanzi', weight)
            output = io.BytesIO()
            font.save(output)
            filename = f'F1UIHanzi-{weight}-{partition}.woff2'
            save(filename, output.getvalue())
            face('F1 UI Hanzi', filename, weight, ranges(points))

font = TTFont(DEST / 'F1UIHanzi-400-core.woff2')
options = subset.Options()
options.flavor = 'woff2'
options.name_IDs = ['*']
subsetter = subset.Subsetter(options=options)
subsetter.populate(unicodes=headline_points)
subsetter.subset(font)
rename(font, 'F1 UI Account Title', 400)
output = io.BytesIO()
font.save(output)
save('F1UIAccountTitle-400.woff2', output.getvalue())
face('F1 UI Account Title', 'F1UIAccountTitle-400.woff2', 400, ranges(headline_points))

(ROOT / 'src' / 'styles' / 'fonts.css').write_text('\n'.join(CSS) + '\n', encoding='utf-8')
(DEST / 'manifest.json').write_text(json.dumps({'source': 'https://github.com/IBM/plex',
    'license': 'OFL-1.1', 'packages': {f'@ibm/plex-{name}': version for name, version, *_ in packages}
    | {'@ibm/plex-sans-sc': '1.1.0'}, 'uiCodepoints': sorted(all_chars),
    'accountTitleCodepoints': sorted(headline_points), 'assets': ASSETS}, indent=2) + '\n', encoding='utf-8')
print(f'Built {len(ASSETS)} fonts, {len(core_chars)} core / {len(all_chars)} UI codepoints, '
      f'{sum(asset["bytes"] for asset in ASSETS) / 1024:.1f} KiB total')
