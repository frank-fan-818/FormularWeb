import { useCallback, useEffect, useState } from 'react';
import { Avatar } from 'antd';
import { UserOutlined } from '@ant-design/icons';

/**
 * Map of F1 driver IDs to their Wikipedia page titles.
 * The Wikipedia REST API Summary endpoint returns a `thumbnail.source` URL
 * for the page's representative image, which for drivers is typically a
 * portrait / headshot photo.
 */
const DRIVER_WIKI_PAGE: Record<string, string> = {
  max_verstappen: 'Max_Verstappen',
  perez: 'Sergio_Perez',
  checo_perez: 'Sergio_Perez',
  lewis_hamilton: 'Lewis_Hamilton',
  george_russell: 'George_Russell_(racing_driver)',
  charles_leclerc: 'Charles_Leclerc',
  carlos_sainz: 'Carlos_Sainz_Jr.',
  carlos_sainz_jr: 'Carlos_Sainz_Jr.',
  lando_norris: 'Lando_Norris',
  oscar_piastri: 'Oscar_Piastri',
  fernando_alonso: 'Fernando_Alonso',
  lance_stroll: 'Lance_Stroll',
  pierre_gasly: 'Pierre_Gasly',
  jack_doohan: 'Jack_Doohan',
  yuki_tsunoda: 'Yuki_Tsunoda',
  isack_hadjar: 'Isack_Hadjar',
  alex_albon: 'Alexander_Albon',
  nico_hulkenberg: 'Nico_Hulkenberg',
  gabriel_bortoleto: 'Gabriel_Bortoleto',
  esteban_ocon: 'Esteban_Ocon',
  oliver_bearman: 'Oliver_Bearman',
  kimi_raikkonen: 'Kimi_Raikkonen',
  antonelli: 'Andrea_Kimi_Antonelli',
  liam_lawson: 'Liam_Lawson',
  franco_colapinto: 'Franco_Colapinto',
  valtteri_bottas: 'Valtteri_Bottas',
  zhou_guanyu: 'Zhou_Guanyu',
  kevin_magnussen: 'Kevin_Magnussen',
  daniel_ricciardo: 'Daniel_Ricciardo',
  logan_sargeant: 'Logan_Sargeant',
  nyck_de_vries: 'Nyck_de_Vries',
};

/**
 * In-memory cache that stores fetched thumbnail URLs per driver ID.
 * - Missing key: never fetched
 * - null value: fetched but no thumbnail available
 * - string value: the thumbnail URL
 */
const thumbnailCache = new Map<string, string | null>();

/** Shape returned by the Wikipedia REST API Summary endpoint. */
interface WikipediaSummaryResponse {
  thumbnail?: {
    source?: string;
  };
}

/**
 * Returns the Wikipedia page title for a given driver ID.
 */
export function getDriverWikipediaPage(driverId: string): string | null {
  return DRIVER_WIKI_PAGE[driverId] ?? null;
}

/**
 * Returns the Wikipedia REST API summary URL for a driver.
 * The JSON response contains a `thumbnail.source` field with the actual
 * headshot image URL.
 *
 * Example response shape:
 * ```json
 * { "thumbnail": { "source": "https://upload.wikimedia.org/..." } }
 * ```
 */
export function getDriverImageUrl(driverId: string): string | null {
  const page = getDriverWikipediaPage(driverId);
  if (!page) return null;
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`;
}

/**
 * Derives initials (up to two characters) from the driver's given and family
 * names. Falls back to "?" when neither name is available.
 */
function getInitials(givenName?: string, familyName?: string): string {
  const first = givenName ? givenName.charAt(0) : '';
  const last = familyName ? familyName.charAt(0) : '';
  return (first + last).toUpperCase() || '?';
}

/**
 * Deterministically picks a hue / background colour for a driver based on
 * their ID so the same driver always gets the same colour.
 */
function getDriverColor(driverId: string): string {
  const palette = [
    '#e80020', '#1e5bc6', '#dc0000', '#00d2be', '#ff8700',
    '#006f62', '#0090ff', '#2b4562', '#900000', '#005aff',
    '#00e700', '#520073', '#004225', '#e69a00', '#8b4513',
    '#2e8b57', '#4169e1', '#ba55d3', '#daa520', '#ff69b4',
  ];
  let hash = 0;
  for (let i = 0; i < driverId.length; i++) {
    hash = driverId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

export interface DriverAvatarProps {
  /** Ergast / internal F1 driver ID (e.g. "max_verstappen"). */
  driverId: string;
  /** Diameter of the avatar in pixels. Default 40. */
  size?: number;
  /** Driver's given name, used to compute fallback initials. */
  givenName?: string;
  /** Driver's family name, used to compute fallback initials. */
  familyName?: string;
}

/**
 * Renders a driver's headshot photo obtained from Wikipedia.
 *
 * - **Loading:** displays a generic user icon on a coloured background.
 * - **Success:** displays the Wikipedia thumbnail image.
 * - **Error / no image:** falls back to the driver's initials on a
 *   deterministic coloured background.
 *
 * Fetched thumbnail URLs are cached in-memory so subsequent renders for the
 * same driver ID are instant.
 */
export const DriverAvatar: React.FC<DriverAvatarProps> = ({
  driverId,
  size = 40,
  givenName,
  familyName,
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(() => {
    return thumbnailCache.has(driverId) ? thumbnailCache.get(driverId)! : null;
  });
  const [loading, setLoading] = useState(!thumbnailCache.has(driverId));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);

    // Return immediately when the result is already cached.
    if (thumbnailCache.has(driverId)) {
      const cached = thumbnailCache.get(driverId);
      setImgSrc(cached ?? null);
      setLoading(false);
      return;
    }

    const apiUrl = getDriverImageUrl(driverId);
    if (!apiUrl) {
      thumbnailCache.set(driverId, null);
      setImgSrc(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetch(apiUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Wikipedia API returned ${res.status}`);
        return res.json() as Promise<WikipediaSummaryResponse>;
      })
      .then((data) => {
        if (cancelled) return;
        const url = data?.thumbnail?.source ?? null;
        thumbnailCache.set(driverId, url);
        setImgSrc(url);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        thumbnailCache.set(driverId, null);
        setImgSrc(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [driverId]);

  const handleImgError = useCallback(() => {
    setImgError(true);
    return false;
  }, []);

  const bgColor = getDriverColor(driverId);

  if (loading) {
    return (
      <Avatar
        size={size}
        icon={<UserOutlined />}
        style={{ backgroundColor: bgColor }}
      />
    );
  }

  if (!imgSrc || imgError) {
    const initials = getInitials(givenName, familyName);
    return (
      <Avatar
        size={size}
        style={{ backgroundColor: bgColor, verticalAlign: 'middle' }}
      >
        {initials}
      </Avatar>
    );
  }

  return (
    <Avatar
      size={size}
      src={imgSrc}
      onError={handleImgError}
      alt={`${givenName ?? ''} ${familyName ?? ''}`.trim() || driverId}
    />
  );
};
