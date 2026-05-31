import { useCallback, useEffect, useState } from 'react';
import { Avatar } from 'antd';
import { getTeamColor } from './teamColors';

/**
 * Map of F1 constructor IDs to their Wikipedia page titles.
 * The Wikipedia REST API Summary endpoint returns a `thumbnail.source`
 * image URL; for constructor / team pages this is typically the team logo.
 */
const CONSTRUCTOR_WIKI_PAGE: Record<string, string> = {
  red_bull: 'Red_Bull_Racing',
  mercedes: 'Mercedes-Benz_in_Formula_One',
  ferrari: 'Scuderia_Ferrari',
  mclaren: 'McLaren',
  aston_martin: 'Aston_Martin_in_Formula_One',
  alpine: 'Alpine_F1_Team',
  haas: 'Haas_F1_Team',
  rb: 'RB_Formula_One_Team',
  alphatauri: 'Scuderia_AlphaTauri',
  williams: 'Williams_Racing',
  sauber: 'Sauber',
  kick_sauber: 'Sauber',
  racing_bulls: 'RB_Formula_One_Team',
  alfa: 'Alfa_Romeo_in_Formula_One',
  audi: 'Audi_in_Formula_One',
};

/**
 * In-memory cache that stores fetched logo URLs per constructor ID.
 * - Missing key: never fetched
 * - null value: fetched but no logo available
 * - string value: the logo URL
 */
const logoCache = new Map<string, string | null>();

/** Shape returned by the Wikipedia REST API Summary endpoint. */
interface WikipediaSummaryResponse {
  thumbnail?: {
    source?: string;
  };
}

/**
 * Returns the Wikipedia page title for a given constructor ID.
 */
export function getConstructorWikipediaPage(constructorId: string): string | null {
  return CONSTRUCTOR_WIKI_PAGE[constructorId] ?? null;
}

/**
 * Returns the Wikipedia REST API summary URL for a constructor.
 * The JSON response contains a `thumbnail.source` field with the team logo
 * image URL.
 *
 * Example response shape:
 * ```json
 * { "thumbnail": { "source": "https://upload.wikimedia.org/..." } }
 * ```
 */
export function getConstructorLogoUrl(constructorId: string): string | null {
  const page = getConstructorWikipediaPage(constructorId);
  if (!page) return null;
  return `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`;
}

export interface ConstructorLogoProps {
  /** Ergast / internal F1 constructor ID (e.g. "red_bull", "ferrari"). */
  constructorId: string;
  /** Diameter of the avatar in pixels. Default 40. */
  size?: number;
}

/**
 * Renders a constructor's team logo obtained from Wikipedia.
 *
 * - **Loading:** displays the first letter of the constructor ID on a team-
 *   coloured background.
 * - **Success:** displays the Wikipedia infobox / thumbnail image.
 * - **Error / no image:** falls back to a team-coloured dot with the first
 *   letter of the constructor ID.
 *
 * Fetched logo URLs are cached in-memory so subsequent renders for the same
 * constructor ID are instant.
 */
export const ConstructorLogo: React.FC<ConstructorLogoProps> = ({
  constructorId,
  size = 40,
}) => {
  const [imgSrc, setImgSrc] = useState<string | null>(() => {
    return logoCache.has(constructorId) ? logoCache.get(constructorId)! : null;
  });
  const [loading, setLoading] = useState(!logoCache.has(constructorId));
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);

    // Return immediately when the result is already cached.
    if (logoCache.has(constructorId)) {
      const cached = logoCache.get(constructorId);
      setImgSrc(cached ?? null);
      setLoading(false);
      return;
    }

    const apiUrl = getConstructorLogoUrl(constructorId);
    if (!apiUrl) {
      logoCache.set(constructorId, null);
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
        logoCache.set(constructorId, url);
        setImgSrc(url);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        logoCache.set(constructorId, null);
        setImgSrc(null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [constructorId]);

  const handleImgError = useCallback(() => {
    setImgError(true);
    return false;
  }, []);

  const fallbackLetter = constructorId.charAt(0).toUpperCase();
  const teamColor = getTeamColor(constructorId);

  if (loading) {
    return (
      <Avatar size={size} style={{ backgroundColor: teamColor }}>
        {fallbackLetter}
      </Avatar>
    );
  }

  if (!imgSrc || imgError) {
    return (
      <Avatar size={size} style={{ backgroundColor: teamColor }}>
        {fallbackLetter}
      </Avatar>
    );
  }

  return (
    <Avatar
      size={size}
      src={imgSrc}
      onError={handleImgError}
      alt={constructorId}
    />
  );
};
