import { useState } from 'react';

import { getDriverFallbackInitials, getDriverMedia } from './f1Media';

// Local cache fallback — if image fails, show initials
const FALLBACK_IDS = new Set<string>();

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
  const media = getDriverMedia(driverId);
  const [errored, setErrored] = useState(
    () => !media.isDeclared || FALLBACK_IDS.has(media.canonicalId),
  );

  if (errored) {
    const initials = getDriverFallbackInitials(driverId, givenName, familyName);
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
      src={media.path}
      alt={`${givenName ?? ''} ${familyName ?? ''}`.trim() || driverId}
      className={className}
      style={{
        width: size, height: size, borderRadius: '50%',
        objectFit: 'cover', flexShrink: 0,
      }}
      loading="lazy"
      onError={() => { FALLBACK_IDS.add(media.canonicalId); setErrored(true); }}
    />
  );
};
