import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { createGzip } from 'node:zlib';

const distRoot = resolve(import.meta.dirname, '..', 'dist');
const host = '127.0.0.1';
const port = 4173;
const mockF1Api = process.env.F1_API_MOCK_EMPTY === '1';
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
};
const gzipExtensions = new Set(['.css', '.html', '.js', '.json', '.svg', '.webmanifest']);

if (!existsSync(resolve(distRoot, 'index.html'))) {
  throw new Error('dist/index.html is missing; run npm run build first.');
}

const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url || '/', `http://${host}`).pathname);

  if (mockF1Api && pathname.startsWith('/f1-api/')) {
    response.statusCode = 200;
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.end(JSON.stringify({
      MRData: {
        total: '0',
        RaceTable: { Races: [] },
        SeasonTable: { Seasons: [] },
        StandingsTable: { StandingsLists: [] },
      },
    }));
    return;
  }

  const requestedPath = resolve(distRoot, `.${pathname}`);
  const insideDist = requestedPath === distRoot || requestedPath.startsWith(`${distRoot}${sep}`);
  const filePath = insideDist && existsSync(requestedPath) && statSync(requestedPath).isFile()
    ? requestedPath
    : resolve(distRoot, 'index.html');

  response.statusCode = 200;
  response.setHeader('Cache-Control', 'no-store');
  const extension = extname(filePath);
  response.setHeader('Content-Type', contentTypes[extension] || 'application/octet-stream');
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
