import { useState } from 'react';

import { getConstructorFallbackLabel, getConstructorMedia } from './f1Media';

const FALLBACK_IDS = new Set<string>();

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
  const media = getConstructorMedia(constructorId);
  const [errored, setErrored] = useState(
    () => !media.isDeclared || FALLBACK_IDS.has(media.canonicalId),
  );

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
        {getConstructorFallbackLabel(constructorId)}
      </span>
    );
  }

  return (
    <img
      src={media.path}
      alt={constructorId}
      className={className}
      style={{ height: size, width: 'auto', objectFit: 'contain', filter: media.filter }}
      loading="lazy"
      onError={() => { FALLBACK_IDS.add(media.canonicalId); setErrored(true); }}
    />
  );
};
