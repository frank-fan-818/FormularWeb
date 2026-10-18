import portraits from '@/data/driver-portraits.json';
import { getDriverMedia } from '@/utils/f1Media';

const NATIONALITY_FLAGS: Record<string, string> = {
  italian: 'it', italy: 'it', british: 'gb', britain: 'gb', 'united kingdom': 'gb',
  dutch: 'nl', netherlands: 'nl', monegasque: 'mc', monaco: 'mc',
  australian: 'au', australia: 'au', thai: 'th', thailand: 'th',
  french: 'fr', france: 'fr', finnish: 'fi', finland: 'fi',
  german: 'de', germany: 'de', brazilian: 'br', brazil: 'br',
  argentine: 'ar', argentinian: 'ar', argentina: 'ar', mexican: 'mx', mexico: 'mx',
  canadian: 'ca', canada: 'ca', spanish: 'es', spain: 'es',
  japanese: 'jp', japan: 'jp', chinese: 'cn', china: 'cn',
  danish: 'dk', denmark: 'dk', 'new zealander': 'nz', 'new zealand': 'nz',
  american: 'us', 'united states': 'us', 'american-italian': 'us',
  polish: 'pl', poland: 'pl', russian: 'ru', russia: 'ru',
  belgian: 'be', belgium: 'be', austrian: 'at', austria: 'at',
  swedish: 'se', sweden: 'se', swiss: 'ch', switzerland: 'ch',
  'south african': 'za', 'south africa': 'za', indian: 'in', india: 'in',
  portuguese: 'pt', portugal: 'pt', colombian: 'co', colombia: 'co',
  venezuelan: 've', venezuela: 've', irish: 'ie', ireland: 'ie',
  hungarian: 'hu', hungary: 'hu', czech: 'cz', 'czech republic': 'cz',
};

export function getNationalityFlag(nationality: string): string | null {
  const code = NATIONALITY_FLAGS[nationality.trim().toLowerCase()];
  return code ? `/images/flags/${code}.svg` : null;
}

export function getDriverPortrait(
  driverId: string, season: string, givenName?: string, familyName?: string,
): string | null {
  if (season !== String(portraits.season)) return null;
  const media = getDriverMedia(driverId, givenName, familyName);
  if (!media.isDeclared) return null;
  const entry = (portraits.drivers as Record<string, { file: string }>)[media.canonicalId];
  return entry ? `/images/drivers/portraits/${entry.file}` : null;
}
