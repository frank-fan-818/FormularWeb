import { useEffect, useState } from 'react';
import { resolveCircuitImageSvg, resolveCircuitImageUrl } from '@/utils/circuitImageResolver';

interface CircuitImageProps {
  alt: string;
  circuitId: string;
  className?: string;
  showSectors?: boolean;
}

const TEXT = {
  unavailable: '\u8d5b\u9053\u56fe\u6682\u4e0d\u53ef\u7528',
  loading: '\u8d5b\u9053\u56fe\u52a0\u8f7d\u4e2d',
};

interface InlineCircuitSvg {
  width: string;
  height: string;
  path: string;
}

const SVG_ATTRIBUTE_PATTERN = (name: string) => new RegExp(`${name}=("|')([^"']+)\\1`);

function parseCircuitSvg(svgText: string): InlineCircuitSvg | null {
  const path = svgText.match(/<path[^>]*\sd=("|')([^"']+)\1/)?.[2];
  if (!path) {
    return null;
  }

  return {
    width: svgText.match(SVG_ATTRIBUTE_PATTERN('width'))?.[2] || '500',
    height: svgText.match(SVG_ATTRIBUTE_PATTERN('height'))?.[2] || '500',
    path,
  };
}

function svgTextToDataUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

const CircuitImage = ({ alt, circuitId, className, showSectors = false }: CircuitImageProps) => {
  const [imageUrl, setImageUrl] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [inlineSvg, setInlineSvg] = useState<InlineCircuitSvg | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setImageFailed(false);
    setInlineSvg(null);
    setImageUrl('');
    setLoading(true);

    const resolveImage = showSectors
      ? resolveCircuitImageSvg(circuitId, 'black-outline').then((svgText) => {
        if (!svgText) {
          return '';
        }

        const parsedSvg = parseCircuitSvg(svgText);
        if (!cancelled) {
          setInlineSvg(parsedSvg);
        }

        return parsedSvg ? '' : svgTextToDataUrl(svgText);
      })
      : resolveCircuitImageUrl(circuitId, 'black-outline');

    resolveImage
      .then((resolvedUrl) => {
        if (!cancelled && resolvedUrl) {
          setImageUrl(resolvedUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInlineSvg(null);
          setImageUrl('');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [circuitId, showSectors]);

  if (loading) {
    return (
      <div
        className={showSectors ? 'circuit-sector-frame circuit-image-loading' : 'circuit-image-loading'}
        aria-label={TEXT.loading}
      />
    );
  }

  if ((!imageUrl && !inlineSvg) || imageFailed) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 240,
          color: '#8c8c8c',
        }}
      >
        {TEXT.unavailable}
      </div>
    );
  }

  if (showSectors && inlineSvg) {
    return (
      <div className="circuit-sector-map">
        <svg
          viewBox={`0 0 ${inlineSvg.width} ${inlineSvg.height}`}
          role="img"
          aria-label={alt}
          className={className}
        >
          <path className="sector-map-shadow" d={inlineSvg.path} pathLength={100} />
          <path className="sector-map-base" d={inlineSvg.path} pathLength={100} />
          <path className="sector-map-sector sector-map-sector-1" d={inlineSvg.path} pathLength={100} />
          <path className="sector-map-sector sector-map-sector-2" d={inlineSvg.path} pathLength={100} />
          <path className="sector-map-sector sector-map-sector-3" d={inlineSvg.path} pathLength={100} />
        </svg>
      </div>
    );
  }

  return (
    <div
      className={showSectors ? 'circuit-sector-frame' : undefined}
      style={{
        minHeight: 240,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <img
        src={imageUrl}
        alt={alt}
        className={className}
        decoding="async"
        onError={() => setImageFailed(true)}
      />
    </div>
  );
};

export default CircuitImage;
