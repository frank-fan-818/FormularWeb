export function parseCircuitSvg(svgText: string) {
  const attribute = (name: string) => svgText.match(new RegExp(`\\b${name}=("|')([^"']+)\\1`))?.[2];
  const path = svgText.match(/<path[^>]*\sd=("|')([^"']+)\1/)?.[2];
  if (!path) return null;
  const width = parseFloat(attribute('width') || '500');
  const height = parseFloat(attribute('height') || '500');
  return {
    path,
    viewBox: attribute('viewBox') || `0 0 ${Number.isFinite(width) ? width : 500} ${Number.isFinite(height) ? height : 500}`,
  };
}
