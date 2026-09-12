import { describe, expect, it } from 'vitest';
import { discoverFiaDocuments, findFiaEventPage, selectFiaUpgradeRaces, validateFiaPublication } from './fiaUpgradeAutomation';

const race = { season: '2026', round: '13', raceName: 'Italian Grand Prix', date: '2026-09-06', time: '13:00:00Z' };
const metadata = { season: 2026, round: 13, grandPrix: race.raceName,
  documentUrl: 'https://www.fia.com/system/files/2026_italian_grand_prix_car_presentation_submissions.pdf' };
const teams = ['McLaren', 'Mercedes', 'Red Bull Racing', 'Ferrari', 'Williams', 'Racing Bulls',
  'Aston Martin', 'Haas', 'Audi', 'Alpine', 'Cadillac'];
const text = `2026 Italian Grand Prix\nCar Presentation Submissions\n${teams.map(team => `${team}\nNo updates submitted for this event.`).join('\n')}`;

describe('FIA upgrade automation', () => {
  it('checks the five-day pre-race window plus two days for late revisions', () => {
    expect(selectFiaUpgradeRaces([race], Date.parse('2026-09-02T00:00:00Z'))).toEqual([race]);
    expect(selectFiaUpgradeRaces([race], Date.parse('2026-08-30T00:00:00Z'))).toEqual([]);
    expect(selectFiaUpgradeRaces([race], Date.parse('2026-09-08T12:00:00Z'))).toEqual([race]);
    expect(selectFiaUpgradeRaces([race], Date.parse('2026-09-09T00:00:00Z'))).toEqual([]);
  });
  it('resolves the season-scoped event URL from FIA options', () => {
    expect(findFiaEventPage('<option value="/documents/official-regulations/event/Italian%20Grand%20Prix">Italian Grand Prix</option>',
      '/documents/official-regulations/season/season-2026-2072', race.raceName))
      .toBe('https://www.fia.com/documents/official-regulations/season/season-2026-2072/event/Italian%20Grand%20Prix');
  });
  it('accepts Barcelona naming and ignores unrelated documents and hosts', () => {
    expect(findFiaEventPage('<option value="/documents/official-regulations/event/Barcelona-Catalunya">Barcelona-Catalunya</option>',
      '/documents/official-regulations/season/season-2026-2072', 'Barcelona-Catalunya Grand Prix')).toContain('/event/Barcelona-Catalunya');
    const url = metadata.documentUrl;
    expect(discoverFiaDocuments(`<a href="${url}">Doc 10</a><a href="${url}">duplicate</a>
      <a href="https://evil.test/2026_car_presentation_submissions.pdf">Car Presentation Submissions</a>
      <a href="/2025_car_presentation_submissions.pdf">old</a><a href="/2026_car_display_procedure.pdf">display</a>`, 2026)).toEqual([url]);
  });
  it('allows a complete all-zero declaration but rejects a truncated or wrong-race PDF', () => {
    expect(validateFiaPublication(text, metadata).records).toEqual([]);
    expect(() => validateFiaPublication(text.replace('Cadillac', 'Missing team'), metadata)).toThrow(/team/i);
    expect(() => validateFiaPublication(text, { ...metadata, grandPrix: 'Spanish Grand Prix' })).toThrow(/document/i);
  });
  it('rejects partially parsed component tables before publication', () => {
    const partial = text.replace('McLaren\nNo updates submitted for this event.',
      'McLaren\nUpdated component\n1 Floor Performance - Local Load Revised floor.\n3 Wing Performance - Local Load');
    expect(() => validateFiaPublication(partial, metadata)).toThrow(/component/i);
  });
});
