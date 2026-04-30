import { useEffect, useState } from 'react';
import { getCircuitImageUrl } from '@/utils/circuitImageResolver';

interface CircuitImageProps {
  alt: string;
  circuitId: string;
  className?: string;
  showSectors?: boolean;
}

const TEXT = {
  unavailable: '\u8d5b\u9053\u56fe\u6682\u4e0d\u53ef\u7528',
};

interface InlineCircuitSvg {
  width: string;
  height: string;
  path: string;
}

function parseCircuitSvg(svgText: string): InlineCircuitSvg | null {
  const path = svgText.match(/<path[^>]*\sd="([^"]+)"/)?.[1];
  if (!path) {
    return null;
  }

  return {
    width: svgText.match(/<svg[^>]*\swidth="([^"]+)"/)?.[1] || '500',
    height: svgText.match(/<svg[^>]*\sheight="([^"]+)"/)?.[1] || '500',
    path,
  };
}

const CircuitImage = ({ alt, circuitId, className, showSectors = false }: CircuitImageProps) => {
  const imageUrl = getCircuitImageUrl(circuitId, 'black-outline');
  const [imageFailed, setImageFailed] = useState(false);
  const [inlineSvg, setInlineSvg] = useState<InlineCircuitSvg | null>(null);

  useEffect(() => {
    setImageFailed(false);
    setInlineSvg(null);
  }, [imageUrl]);

  useEffect(() => {
    if (!showSectors || !imageUrl) {
      return;
    }

    let cancelled = false;

    fetch(imageUrl)
      .then((response) => response.ok ? response.text() : '')
      .then((text) => {
        if (!cancelled) {
          setInlineSvg(parseCircuitSvg(text));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setInlineSvg(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [imageUrl, showSectors]);

  if (!imageUrl || imageFailed) {
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
        fetchPriority="high"
        decoding="async"
        onError={() => setImageFailed(true)}
      />
      {showSectors ? (
        <div className="circuit-sector-overlay" aria-hidden="true">
          <span className="sector-marker sector-marker-1">S1</span>
          <span className="sector-marker sector-marker-2">S2</span>
          <span className="sector-marker sector-marker-3">S3</span>
          <span className="sector-band sector-band-1" />
          <span className="sector-band sector-band-2" />
          <span className="sector-band sector-band-3" />
        </div>
      ) : null}
    </div>
  );
};

export default CircuitImage;
