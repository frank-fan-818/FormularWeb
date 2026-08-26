import { routeModules, type RouteModuleKey } from '@/router/routeModules';

export type NetworkInformation = { saveData?: boolean; effectiveType?: string };

export function canPreloadRoutes(connection: NetworkInformation | undefined): boolean {
  return !connection?.saveData
    && connection?.effectiveType !== '2g'
    && connection?.effectiveType !== 'slow-2g';
}

function canPrefetch(): boolean {
  if (typeof navigator === 'undefined') return false;
  const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  return canPreloadRoutes(connection);
}

const raceSectionModules: Record<string, RouteModuleKey> = {
  results: 'raceResults',
  qualifying: 'raceQualifying',
  race: 'raceAnalysis',
  sprint: 'raceSprint',
  info: 'raceInfo',
};

export function getRoutePreloadKeys(pathname: string): RouteModuleKey[] {
  const normalizedPath = pathname.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/';
  if (normalizedPath === '/') return [];
  if (normalizedPath === '/seasons') return ['seasons'];
  if (normalizedPath === '/races') return ['races'];

  const raceMatch = normalizedPath.match(/^\/races\/[^/]+(?:\/([^/]+))?$/);
  if (raceMatch) {
    return ['raceLayout', raceSectionModules[raceMatch[1] || 'results'] || 'raceResults'];
  }

  if (normalizedPath === '/drivers') return ['drivers'];
  if (/^\/(?:history\/)?drivers\/[^/]+$/.test(normalizedPath)) return ['driverDetail'];
  if (normalizedPath === '/constructors') return ['constructors'];
  if (/^\/history\/constructors\/[^/]+$/.test(normalizedPath)) return ['constructorHistoryDetail'];
  if (/^\/constructors\/[^/]+$/.test(normalizedPath)) return ['constructorDetail'];
  if (normalizedPath === '/circuits') return ['circuits'];
  if (/^\/circuits\/[^/]+$/.test(normalizedPath)) return ['circuitDetail'];
  if (normalizedPath === '/settings') return ['settings'];
  if (normalizedPath === '/login') return ['login'];
  if (normalizedPath === '/register') return ['register'];
  if (normalizedPath === '/forgot-password') return ['forgotPassword'];
  if (normalizedPath === '/reset-password') return ['resetPassword'];
  if (normalizedPath === '/privacy') return ['privacy'];
  return ['notFound'];
}

export function preloadRoute(pathname: string): void {
  if (!canPrefetch()) return;
  const requests = getRoutePreloadKeys(pathname).map((key) => routeModules[key]());
  void Promise.all(requests).catch(() => {
    // Navigation remains the source of truth when speculative loading fails.
  });
}

export function preloadDriverDetailRoute(driverId: string, season: string): void {
  if (!canPrefetch()) return;
  const requests: Promise<unknown>[] = [
    routeModules.driverDetail(),
    import('@/components/charts/EChartsPanel'),
    import('@/api/ergast').then(({ driverApi, seasonApi }) => Promise.all([
      driverApi.getDriverSeasonRaceResults(driverId, season),
      seasonApi.getSeasonSprintResults(season),
    ])),
  ];
  void Promise.all(requests).catch(() => {
    // Detail navigation owns recovery when speculative loading fails.
  });
}

export function preloadConstructorDetailRoute(constructorId: string, season: string): void {
  if (!canPrefetch()) return;
  const requests: Promise<unknown>[] = [
    routeModules.constructorDetail(),
    import('@/components/charts/EChartsPanel'),
    import('@/api/ergast').then(({ constructorApi, seasonApi }) => Promise.all([
      constructorApi.getConstructorSeasonRaceResults(constructorId, season),
      seasonApi.getSeasonSprintResults(season),
    ])),
  ];
  void Promise.all(requests).catch(() => {
    // Detail navigation owns recovery when speculative loading fails.
  });
}

export function preloadRaceSectionRoute(
  section: string,
  season?: string,
  round?: string,
): void {
  const moduleKey = raceSectionModules[section];
  if (!moduleKey || !canPrefetch()) return;
  const requests: Promise<unknown>[] = [routeModules[moduleKey]()];
  if (section === 'race' && season && round) {
    requests.push(
      import('@/api/fastf1Analytics')
        .then(({ fastF1AnalyticsApi }) => fastF1AnalyticsApi.getRaceAnalytics(season, round, 'R')),
    );
  }
  void Promise.all(requests).catch(() => {
    // Navigation remains the source of truth when speculative loading fails.
  });
}

export function preloadRaceInfoRoute(): void {
  preloadRoute('/races/next/info');
}
