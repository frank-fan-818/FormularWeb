// Offline integration fixture loaded only by fia-refresh.integration.test.mjs.
const scenario = process.env.FIA_TEST_SCENARIO;
globalThis.fetch = async input => {
  const url = String(input);
  const raceAt = new Date(Date.now() + (scenario === 'overdue' ? -1 : 2) * 86400000);
  if (url.startsWith('https://api.jolpi.ca/')) return Response.json({ MRData: {
    total: '1', limit: '100', offset: '0', RaceTable: { Races: [{ season: '2026', round: '15', raceName: 'Azerbaijan Grand Prix', date: raceAt.toISOString().slice(0, 10), time: '12:00:00Z' }] },
  } });
  if (!url.startsWith('https://www.fia.com/')) throw new Error('Unexpected request (must never publish missing data)');
  if (scenario === '403') return new Response('', { status: 403 });
  if (scenario === 'maintenance') return new Response('<img src="/.maintenance/logo.png">');
  if (url.endsWith('/official-regulations')) return new Response('<option value="/documents/official-regulations/season/season-2026-2072">2026</option>');
  if (scenario === 'broken') return new Response('<html>Unknown layout</html>');
  if (url.includes('/event/')) return new Response('<html>No documents yet</html>');
  const event = scenario === 'no-pdf' ? 'Azerbaijan' : 'Italian';
  return new Response(`<option value="/documents/official-regulations/event/${event}">${event} Grand Prix</option>`);
};
