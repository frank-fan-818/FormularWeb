import { useRef, useState } from 'react';
import { getCircuitDetailedMap } from '@/data/circuitDetailedMaps';
import './CircuitImage.css';

interface CircuitImageProps {
  alt: string;
  circuitId: string;
  className?: string;
  variant?: 'preview' | 'technical';
}

function MapUnavailable({ message = '暂无官网赛道图' }: { message?: string }) {
  return <div className="circuit-map-unavailable" role="status">{message}</div>;
}

function OfficialCircuitImage({ map, alt, className, variant = 'preview' }: CircuitImageProps & {
  map: NonNullable<ReturnType<typeof getCircuitDetailedMap>>;
}) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const zoomRef = useRef<HTMLDialogElement>(null);
  if (failed) return <MapUnavailable message="官网赛道图暂不可用" />;

  const image = (
    <img
      src={map.asset}
      alt={alt}
      className={[className, loading ? 'circuit-map-image--pending' : ''].filter(Boolean).join(' ')}
      width={map.width}
      height={map.height}
      loading={variant === 'preview' ? 'lazy' : 'eager'}
      decoding="async"
      aria-hidden={loading || undefined}
      onLoad={() => setLoading(false)}
      onError={() => setFailed(true)}
    />
  );

  return (
    <div className={`circuit-detailed-map circuit-detailed-map--${variant}`} data-map-year={map.year} aria-busy={loading}>
      {loading ? (
        <div className="circuit-image-loading" role="status" aria-label="赛道图加载中">
          <span className="loading-indicator" aria-hidden="true" />
        </div>
      ) : null}
      {variant === 'technical' ? (
        <>
          <button type="button" className="circuit-detailed-map__open" aria-label={`放大${alt}赛道图`}
            disabled={loading} onClick={() => zoomRef.current?.showModal()}>
            {image}
            {!loading ? <span className="circuit-detailed-map__zoom" aria-hidden="true">放大 ↗</span> : null}
          </button>
          <dialog ref={zoomRef} className="circuit-map-zoom" aria-label={`${alt}赛道图`}>
            <div className="circuit-map-zoom__header">
              <strong>{alt}</strong>
              <button type="button" onClick={() => zoomRef.current?.close()} aria-label="关闭赛道图">关闭</button>
            </div>
            <div className="circuit-map-zoom__canvas">
              <img className="circuit-map-zoom__image" src={map.asset} alt={alt} width={map.width} height={map.height} loading="lazy" />
            </div>
          </dialog>
        </>
      ) : image}
    </div>
  );
}

export default function CircuitImage(props: CircuitImageProps) {
  const map = getCircuitDetailedMap(props.circuitId);
  return map
    ? <OfficialCircuitImage key={`${map.asset}-${props.variant || 'preview'}`} {...props} map={map} />
    : <MapUnavailable />;
}
