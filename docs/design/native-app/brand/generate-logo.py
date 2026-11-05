"""Build editable vector brand assets using the local Bahnschrift font outlines.

Only the rendered wordmark paths are exported; no font file is redistributed.
Requires fontTools. Run from any directory on the current Windows workstation.
"""
from pathlib import Path
import argparse
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

parser = argparse.ArgumentParser()
parser.add_argument('--font', default='C:/Windows/Fonts/bahnschrift.ttf')
args = parser.parse_args()
destination = Path(__file__).resolve().parent
font = TTFont(args.font)
if 'fvar' in font:
    supported = {axis.axisTag: axis for axis in font['fvar'].axes}
    axes = {key: max(supported[key].minValue, min(value, supported[key].maxValue))
            for key, value in {'wght': 700, 'wdth': 90}.items() if key in supported}
    font = instantiateVariableFont(font, axes, inplace=False)
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
scale = 34 / font['head'].unitsPerEm

# The letters share their left stem, top bar and middle bar. The right-hand
# loop completes P; matched diagonal joins keep F visible within one silhouette.
mark_f = 'M7 4H28L25 10H13L12 15H25L22 21H11L9 32H3Z'
mark_p = 'M28 4H33C40.5 4 45 7.4 44 13C43 18.6 38.5 21 32 21H22L25 15H32C35.8 15 37.3 14.4 37.6 12.6C37.9 10.8 36.3 10 33 10H25Z'

def word_paths(word, x):
    parts = []
    for character in word:
        glyph = glyphs[cmap[ord(character)]]
        pen = SVGPathPen(glyphs)
        glyph.draw(TransformPen(pen, (scale, 0, 0, -scale, x, 36)))
        parts.append(f'<path d="{pen.getCommands()}"/>')
        x += glyph.width * scale + .15
    return ''.join(parts), x

frank, middle = word_paths('Frank', 60)
pitwall, end = word_paths('Pitwall', middle)
width = round(end + 3, 2)

for mode, ink, accent in [('light', '#222222', '#CC1300'), ('dark', '#E2E8F0', '#FF8A80')]:
    symbol = f'<path fill="#FF1801" d="{mark_f}"/><path fill="{ink}" fill-rule="evenodd" d="{mark_p}"/>'
    mark = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 36" role="img" aria-labelledby="title"><title id="title">FrankPitwall FP 标识</title>{symbol}</svg>\n'
    logo = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 48" role="img" aria-labelledby="title"><title id="title">FrankPitwall</title><g transform="translate(0 6)">{symbol}</g><g fill="{ink}">{frank}</g><g fill="{accent}">{pitwall}</g></svg>\n'
    (destination / f'frankpitwall-mark-{mode}.svg').write_text(mark, encoding='utf-8')
    (destination / f'frankpitwall-logo-{mode}.svg').write_text(logo, encoding='utf-8')
print(f'Created four SVG assets; wordmark viewBox: 0 0 {width} 48')
