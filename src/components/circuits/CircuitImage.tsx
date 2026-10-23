import { useEffect, useId, useState } from 'react';
import { resolveCircuitImageSvg, resolveCircuitImageUrl } from '@/utils/circuitImageResolver';
import { parseCircuitSvg } from '@/utils/circuitSvg';
import { getCircuitDiagramGuide } from '@/data/circuitDiagramGuides';
import './CircuitImage.css';

interface CircuitImageProps {
  alt: string;
  circuitId: string;
  className?: string;
  variant?: 'outline' | 'technical';
}

const TEXT = {
  unavailable: '\u8d5b\u9053\u56fe\u6682\u4e0d\u53ef\u7528',
  loading: '\u8d5b\u9053\u56fe\u52a0\u8f7d\u4e2d',
};

function svgTextToDataUrl(svgText: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

const CircuitImage = ({ alt, circuitId, className, variant = 'outline' }: CircuitImageProps) => {
  const [imageUrl, setImageUrl] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [inlineSvg, setInlineSvg] = useState<ReturnType<typeof parseCircuitSvg>>(null);
  const [loading, setLoading] = useState(true);
  const finishPatternId = useId();
  const technical = variant === 'technical';
  const guide = technical ? getCircuitDiagramGuide(circuitId) : undefined;

  useEffect(() => {
    let cancelled = false;

    setImageFailed(false);
    setInlineSvg(null);
    setImageUrl('');
    setLoading(true);

    const resolveImage = technical
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
  }, [circuitId, technical]);

  if (loading) {
    return (
      <div
        className="circuit-image-loading"
        role="status"
        aria-label={TEXT.loading}
      ><span className="loading-indicator" aria-hidden="true" /></div>
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

  if (technical && inlineSvg) {
    return (
      <div className="circuit-technical-map">
        <svg
          viewBox={guide?.viewBox || inlineSvg.viewBox}
          role="img"
          aria-label={alt}
          className={className}
        >
          <defs>
            <pattern id={finishPatternId} width="8" height="8" patternUnits="userSpaceOnUse">
              <rect width="8" height="8" fill="white" />
              <path d="M0 0h4v4H0zM4 4h4v4H4z" fill="black" />
            </pattern>
          </defs>
          <g transform={guide ? `rotate(${guide.rotation} 250 250)` : undefined}>
            <path className="circuit-track-edge" d={inlineSvg.path} />
            <path className="circuit-track-line" d={inlineSvg.path} />
            {guide?.turns.map(turn => (
              <g key={turn.number} className="circuit-turn-label" transform={`translate(${turn.x} ${turn.y}) rotate(${-guide.rotation})`}>
                <circle r="10" />
                <text textAnchor="middle" dominantBaseline="central">{turn.number}</text>
              </g>
            ))}
            {guide ? <>
              <g transform={`translate(${guide.startFinish.x} ${guide.startFinish.y}) rotate(-4)`}>
                <rect x="-11" y="-5" width="22" height="10" fill={`url(#${finishPatternId})`} stroke="var(--text-primary)" strokeWidth="1" />
              </g>
              <path className="circuit-travel-arrow" d="m135 218 8-14 10 13m-10-13 2 29" />
              <text className="circuit-finish-label" x="169" y="260" transform="rotate(-24 169 260)">S/F</text>
            </> : null}
          </g>
        </svg>
      </div>
    );
  }

  return (
    <div
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
