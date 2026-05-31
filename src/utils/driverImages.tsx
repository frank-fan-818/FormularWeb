import { useState } from 'react';

// Local cache fallback — if image fails, show initials
const FALLBACK_IDS = new Set<string>();

const ALIASES: Record<string, string> = {
  antonelli: 'kimi_antonelli',
};

function resolveId(driverId: string): string {
  return ALIASES[driverId] || driverId;
}

export function getDriverImageUrl(driverId: string): string | null {
  const resolved = resolveId(driverId);
  if (FALLBACK_IDS.has(resolved)) return null;
  return `/images/drivers/${resolved}.png`;
}

function getInitials(givenName?: string, familyName?: string): string {
  const first = givenName ? givenName.charAt(0) : '';
  const last = familyName ? familyName.charAt(0) : '';
  return (first + last).toUpperCase() || '?';
}

function getDriverColor(driverId: string): string {
  const palette = [
    '#dc0000', '#1e5bc6', '#ff8700', '#00d2be', '#e80020',
    '#006f62', '#0090ff', '#2b4562', '#900000', '#005aff',
  ];
  let hash = 0;
  for (let i = 0; i < driverId.length; i++) {
    hash = driverId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export interface DriverAvatarProps {
  driverId: string;
  size?: number;
  givenName?: string;
  familyName?: string;
  className?: string;
}

export const DriverAvatar: React.FC<DriverAvatarProps> = ({
  driverId,
  size = 40,
  givenName,
  familyName,
  className,
}) => {
  const resolvedId = resolveId(driverId);
  const [errored, setErrored] = useState(() => FALLBACK_IDS.has(resolvedId));

  if (errored) {
    const initials = getInitials(givenName, familyName);
    const bgColor = getDriverColor(driverId);
    return (
      <span
        className={className}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: size, height: size, borderRadius: '50%',
          background: bgColor, color: '#fff',
          fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
        }}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={`/images/drivers/${resolvedId}.png`}
      alt={`${givenName ?? ''} ${familyName ?? ''}`.trim() || driverId}
      className={className}
      style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
      }}
      loading="lazy"
      onError={() => { FALLBACK_IDS.add(resolvedId); setErrored(true); }}
    />
  );
};
