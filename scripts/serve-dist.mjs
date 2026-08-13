import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { createGzip } from 'node:zlib';

const distRoot = resolve(import.meta.dirname, '..', 'dist');
const host = '127.0.0.1';
const port = 4173;
const mockF1Api = process.env.F1_API_MOCK_EMPTY === '1';
const mockCanonicalF1Api = process.env.F1_API_MOCK_CANONICAL === '1';
const buildManifest = JSON.parse(
  readFileSync(resolve(distRoot, '.vite', 'manifest.json'), 'utf8'),
);
const appEntryPath = `/${buildManifest['index.html'].file}`;
const settingsAssetPath = `/${buildManifest['src/pages/Settings.tsx'].file}`;
const removedSettingsAssetPath = '/assets/Settings-qa-removed.js';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};
const gzipExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.webmanifest']);

if (!existsSync(resolve(distRoot, 'index.html'))) {
  throw new Error('dist/index.html is missing; run npm run build first.');
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}`).pathname);
  const qaVersion = request.headers.cookie
    ?.match(/(?:^|;\s*)qa-sw-version=([0-9a-f]{12})(?:;|$)/)?.[1];

  if ((mockF1Api || mockCanonicalF1Api) && pathname.startsWith('/f1-api/')) {
    const season = String(new Date().getUTCFullYear());
    const driver = {
      driverId: 'max_verstappen',
      permanentNumber: '3',
      code: 'VER',
      givenName: 'Max',
      familyName: 'Verstappen',
      dateOfBirth: '1997-09-30',
      nationality: 'Dutch',
    };
    const constructor = {
      constructorId: 'red_bull',
      name: 'Red Bull',
      nationality: 'Austrian',
    };
    const isSeasons = pathname.endsWith('/seasons.json');
    const isDriverStandings = pathname.endsWith('/driverStandings.json');
    const isConstructorStandings = pathname.endsWith('/constructorStandings.json');
    const isSeasonCalendar = new RegExp(`/f1-api/${season}\\.json$`).test(pathname);
    const canonicalRace = {
      season,
      round: '1',
      raceName: 'Australian Grand Prix',
      date: `${season}-03-08`,
      time: '04:00:00Z',
      Circuit: {
        circuitId: 'albert_park',
        circuitName: 'Albert Park Grand Prix Circuit',
        Location: {
          locality: 'Melbourne',
          country: 'Australia',
          lat: '-37.8497',
          long: '144.968',
        },
      },
    };
    const standingsLists = isDriverStandings ? [{
      season,
      round: '1',
      DriverStandings: [{
        position: '1',
        positionText: '1',
        points: '25',
        wins: '1',
        Driver: driver,
        Constructors: [constructor],
      }],
    }] : isConstructorStandings ? [{
      season,
      round: '1',
      ConstructorStandings: [{
        position: '1',
        positionText: '1',
        points: '25',
        wins: '1',
        Constructor: constructor,
      }],
    }] : [];
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      MRData: {
        total: mockCanonicalF1Api ? '1' : '0',
        RaceTable: { Races: mockCanonicalF1Api && isSeasonCalendar ? [canonicalRace] : [] },
        SeasonTable: { Seasons: mockCanonicalF1Api && isSeasons ? [{ season }] : [] },
        StandingsTable: { StandingsLists: mockCanonicalF1Api ? standingsLists : [] },
      },
    }));
    return;
  }

  if (pathname === '/sw.js') {
    if (qaVersion) {
      const serviceWorker = readFileSync(resolve(distRoot, 'sw.js'), 'utf8')
        .replace(/f1-shell-[0-9a-f]{12}/g, `f1-shell-${qaVersion}`);
      response.statusCode = 200;
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.end(serviceWorker);
      return;
    }
  }

  if (qaVersion === 'aaaaaaaaaaaa' && pathname === appEntryPath) {
    const oldAppEntry = readFileSync(resolve(distRoot, appEntryPath.slice(1)), 'utf8')
      .replaceAll(settingsAssetPath.split('/').at(-1), removedSettingsAssetPath.split('/').at(-1));
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end(oldAppEntry);
    return;
  }

  if (qaVersion === 'aaaaaaaaaaaa' && pathname === removedSettingsAssetPath) {
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    createReadStream(resolve(distRoot, settingsAssetPath.slice(1))).pipe(response);
    return;
  }

  const requestedPath = resolve(distRoot, `.${pathname}`);
  const insideDist = requestedPath === distRoot || requestedPath.startsWith(`${distRoot}${sep}`);
  const requestedFileExists = insideDist
    && existsSync(requestedPath)
    && statSync(requestedPath).isFile();
  const missingStaticAsset = pathname.startsWith('/assets/') || extname(pathname) !== '';

  if (!requestedFileExists && missingStaticAsset) {
    response.statusCode = 404;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'text/plain; charset=utf-8');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.end('Not found');
    return;
  }

  const filePath = requestedFileExists ? requestedPath : resolve(distRoot, 'index.html');

  response.statusCode = 200;
  const extension = extname(filePath);
  response.setHeader(
    'Cache-Control',
    pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'no-store',
  );
  response.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Vary', 'Accept-Encoding');

  const fileStream = createReadStream(filePath);
  if (gzipExtensions.has(extension) && request.headers['accept-encoding']?.includes('gzip')) {
    response.setHeader('Content-Encoding', 'gzip');
    fileStream.pipe(createGzip()).pipe(response);
    return;
  }

  fileStream.pipe(response);
});

server.listen(port, host, () => {
  process.stdout.write(`Serving dist at http://${host}:${port}\n`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
