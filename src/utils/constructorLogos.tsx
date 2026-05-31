import { useState } from 'react';

const FALLBACK_IDS = new Set<string>();

// Map alternate constructor IDs to the canonical filename ID
const ALIASES: Record<string, string> = {
  alphatauri: 'rb',
  racing_bulls: 'rb',
  kick_sauber: 'sauber',
  alfa: 'mercedes', // Alfa Romeo no longer in F1, use generic fallback
  alfa_romeo: 'mercedes',
};

function resolveId(constructorId: string): string {
  return ALIASES[constructorId] || constructorId;
}

export function getConstructorLogoUrl(constructorId: string): string | null {
  const resolved = resolveId(constructorId);
  if (FALLBACK_IDS.has(resolved)) return null;
  return `/images/constructors/${resolved}.png`;
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
  const resolvedId = resolveId(constructorId);
  const [errored, setErrored] = useState(() => FALLBACK_IDS.has(resolvedId));

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
      src={`/images/constructors/${resolvedId}.png`}
      alt={constructorId}
      className={className}
      style={{ height: size, width: 'auto', objectFit: 'contain' }}
      loading="lazy"
      onError={() => { FALLBACK_IDS.add(resolvedId); setErrored(true); }}
    />
  );
};
