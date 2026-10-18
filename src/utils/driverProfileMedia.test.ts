import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import portraits from '@/data/driver-portraits.json';
import { getDriverPortrait, getNationalityFlag } from './driverProfileMedia';

describe('driver profile media', () => {
  it('ships a genuine local WebP file and official source attribution for every declared portrait', () => {
    for (const entry of Object.values(portraits.drivers)) {
      expect(entry.file).toMatch(/^[a-z_]+\.webp$/);
      expect(new URL(entry.sourcePage).hostname).toBe('www.formula1.com');
      expect(new URL(entry.source).hostname).toBe('media.formula1.com');
      const bytes = readFileSync(resolve('public/images/drivers/portraits', entry.file));
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(bytes.subarray(8, 12).toString()).toBe('WEBP');
      expect(bytes.length).toBeGreaterThan(1000);
    }
  });

  it('ships local SVG flags without embedded scripts or remote image dependencies', () => {
    for (const file of readdirSync('public/images/flags')) {
      const svg = readFileSync(resolve('public/images/flags', file), 'utf8');
      expect(svg).toContain('<svg');
      expect(svg).not.toMatch(/<script|<foreignObject|<image|onload=/i);
    }
  });

  it('resolves known driver aliases to a local standing portrait', () => {
    expect(getDriverPortrait('andrea_kimi_antonelli', '2026')).toBe('/images/drivers/portraits/antonelli.webp');
    expect(getDriverPortrait('carlos_sainz_jr', '2026')).toBe('/images/drivers/portraits/sainz.webp');
    expect(getDriverPortrait('ANT', '2026', 'Andrea Kimi', 'Antonelli')).toBe('/images/drivers/portraits/antonelli.webp');
  });

  it('does not assign current-season portraits to an unknown driver or another season', () => {
    expect(getDriverPortrait('future_driver', '2026')).toBeNull();
    expect(getDriverPortrait('ricciardo', '2026')).toBeNull();
    expect(getDriverPortrait('antonelli', '2025')).toBeNull();
  });

  it('uses nationality rather than the constructor nationality for the flag', () => {
    expect(getNationalityFlag(' Italian ')).toBe('/images/flags/it.svg');
    expect(getNationalityFlag('Monegasque')).toBe('/images/flags/mc.svg');
    expect(getNationalityFlag('New Zealander')).toBe('/images/flags/nz.svg');
    expect(getNationalityFlag('Unknown')).toBeNull();
    expect(getNationalityFlag('')).toBeNull();
  });
});
