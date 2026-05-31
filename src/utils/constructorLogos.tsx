import { useState } from 'react';

/**
 * F1 constructor logos from the official Formula 1 CDN.
 * These are the crisp, clean team logos used on formula1.com.
 */
const LOGO_URLS: Record<string, string> = {
  red_bull: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/red-bull-racing-logo.png',
  mercedes: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/mercedes-logo.png',
  ferrari: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/ferrari-logo.png',
  mclaren: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/mclaren-logo.png',
  aston_martin: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/aston-martin-logo.png',
  alpine: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/alpine-logo.png',
  haas: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/haas-logo.png',
  rb: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/rb-logo.png',
  racing_bulls: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/rb-logo.png',
  williams: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/williams-logo.png',
  sauber: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/kick-sauber-logo.png',
  kick_sauber: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2025/kick-sauber-logo.png',
  alphatauri: 'https://media.formula1.com/d_team_fallback_logo.png/content/dam/fom-website/teams/2023/alphatauri-logo.png',
};

export function getConstructorLogoUrl(constructorId: string): string | null {
  return LOGO_URLS[constructorId] ?? null;
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
  const [errored, setErrored] = useState(false);
  const url = getConstructorLogoUrl(constructorId);

  if (!url || errored) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          background: '#1e293b',
          borderRadius: 6,
          color: '#94a3b8',
          fontSize: size * 0.35,
          fontWeight: 700,
          textAlign: 'center',
          lineHeight: `${size}px`,
          textTransform: 'uppercase',
        }}
      >
        {constructorId.charAt(0)}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt={constructorId}
      className={className}
      style={{ height: size, width: 'auto', objectFit: 'contain' }}
      loading="lazy"
      onError={() => setErrored(true)}
    />
  );
};
