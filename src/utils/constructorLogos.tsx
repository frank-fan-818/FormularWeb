import { useState } from 'react';

const FALLBACK_IDS = new Set<string>();

export function getConstructorLogoUrl(constructorId: string): string | null {
  if (FALLBACK_IDS.has(constructorId)) return null;
  return `/images/constructors/${constructorId}.png`;
}

interface ConstructorLogoProps {
  constructorId: string;
  size?: number;
  className?: string;
}

export const ConstructorLogo: React.FC<ConstructorLogoProps> = ({
  constructorId,
  size = 32,
  className,
}) => {
  const [errored, setErrored] = useState(() => FALLBACK_IDS.has(constructorId));

  if (errored) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block', width: size, height: size,
          background: '#1e293b', borderRadius: 6,
          color: '#94a3b8', fontSize: size * 0.35, fontWeight: 700,
          textAlign: 'center', lineHeight: `${size}px`,
          textTransform: 'uppercase',
        }}
      >
        {constructorId.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={`/images/constructors/${constructorId}.png`}
      alt={constructorId}
      className={className}
      style={{ height: size, width: 'auto', objectFit: 'contain' }}
      loading="lazy"
      onError={() => { FALLBACK_IDS.add(constructorId); setErrored(true); }}
    />
  );
};
