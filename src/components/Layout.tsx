import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSeasons } from '@/hooks';
import { useAppStore } from '@/store';
import './Layout.css';

const GlobalSearchBox = lazy(() => import('@/components/GlobalSearchBox'));

const TEXT = {
  home: '\u9996\u9875',
  seasonStandings: '\u8d5b\u5b63\u79ef\u5206',
  races: '\u5206\u7ad9\u8d5b\u4e8b',
  drivers: '\u8f66\u624b',
  constructors: '\u8f66\u961f',
  circuits: '\u8d5b\u9053',
  databaseAudit: '\u6570\u636e\u5e93\u5ba1\u8ba1',
  searching: '\u52a0\u8f7d\u641c\u7d22\u4e2d...',
  searchPlaceholder: '\u641c\u7d22\u8f66\u624b\u3001\u8f66\u961f\u6216\u8d5b\u9053',
  appName: 'F1 \u6570\u636e\u4e2d\u5fc3',
  currentSeason: '\u5f53\u524d\u8d5b\u5b63',
};

interface IconProps {
  className?: string;
}

const IconBase = ({
  className,
  children,
  viewBox = '0 0 24 24',
}: IconProps & { children: React.ReactNode; viewBox?: string }) => (
  <svg
    className={className}
    viewBox={viewBox}
    aria-hidden="true"
    focusable="false"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </svg>
);

const HomeIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M6.5 10.5V20h11V10.5" />
    <path d="M10 20v-5.5h4V20" />
  </IconBase>
);

const SeasonIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <rect x="4" y="5" width="16" height="15" rx="2.5" />
    <path d="M8 3.5V7" />
    <path d="M16 3.5V7" />
    <path d="M4 10h16" />
    <path d="M8 13.5h3" />
    <path d="M13 13.5h3" />
  </IconBase>
);

const RaceIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M7.5 6.5h9l1.2 4.2H6.3L7.5 6.5Z" />
    <path d="M5.5 10.7h13l1 3.8H4.5l1-3.8Z" />
    <circle cx="7.5" cy="17.2" r="1.8" />
    <circle cx="16.5" cy="17.2" r="1.8" />
    <path d="M9.8 8.2h4.4" />
  </IconBase>
);

const DriverIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <circle cx="12" cy="8" r="3" />
    <path d="M6.5 19.5a5.5 5.5 0 0 1 11 0" />
    <path d="M5 12.5h3" />
    <path d="M16 12.5h3" />
  </IconBase>
);

const ConstructorIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M6 17.5V9.2a2.2 2.2 0 0 1 2.2-2.2h7.6A2.2 2.2 0 0 1 18 9.2v8.3" />
    <path d="M9 17.5V12h6v5.5" />
    <path d="M4.5 17.5h15" />
    <path d="M8.5 7V4.5" />
    <path d="M15.5 7V4.5" />
  </IconBase>
);

const CircuitIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M6 16.5c0-4.5 4.5-1 4.5-5.2S7 7.5 10.5 7.5 15 9 15 11.3s3 .9 3 3.7c0 1.9-1.6 3.5-3.5 3.5S11 17 9.2 17H8.5" />
    <circle cx="6" cy="16.5" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="18" cy="15" r="1.2" fill="currentColor" stroke="none" />
  </IconBase>
);

const DatabaseIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <ellipse cx="12" cy="6.5" rx="6.5" ry="2.8" />
    <path d="M5.5 6.5v5.5c0 1.6 2.9 2.8 6.5 2.8s6.5-1.2 6.5-2.8V6.5" />
    <path d="M5.5 12v5.5c0 1.6 2.9 2.8 6.5 2.8s6.5-1.2 6.5-2.8V12" />
  </IconBase>
);

const MenuFoldIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M4 6.5h9" />
    <path d="M4 12h9" />
    <path d="M4 17.5h9" />
    <path d="m16 8 4 4-4 4" />
  </IconBase>
);

const MenuUnfoldIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M11 6.5h9" />
    <path d="M11 12h9" />
    <path d="M11 17.5h9" />
    <path d="m8 8-4 4 4 4" />
  </IconBase>
);

const SearchIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <circle cx="11" cy="11" r="5.2" />
    <path d="m15 15 4.2 4.2" />
  </IconBase>
);

type NavigatorWithConnection = Navigator & {
  connection?: {
    saveData?: boolean;
  };
};

type WindowWithIdleCallback = Window & typeof globalThis & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const navItems = [
  { key: '/', icon: HomeIcon, label: TEXT.home },
  { key: '/seasons', icon: SeasonIcon, label: TEXT.seasonStandings },
  { key: '/races', icon: RaceIcon, label: TEXT.races },
  { key: '/drivers', icon: DriverIcon, label: TEXT.drivers },
  { key: '/constructors', icon: ConstructorIcon, label: TEXT.constructors },
  { key: '/circuits', icon: CircuitIcon, label: TEXT.circuits },
  { key: '/database', icon: DatabaseIcon, label: TEXT.databaseAudit },
];

const resolveActiveNavKey = (pathname: string) => {
  if (pathname === '/') {
    return '/';
  }

  if (pathname.startsWith('/history/drivers') || pathname.startsWith('/drivers')) {
    return '/drivers';
  }

  if (pathname.startsWith('/history/constructors') || pathname.startsWith('/constructors')) {
    return '/constructors';
  }

  if (pathname.startsWith('/circuits')) {
    return '/circuits';
  }

  if (pathname.startsWith('/races')) {
    return '/races';
  }

  if (pathname.startsWith('/seasons')) {
    return '/seasons';
  }

  if (pathname.startsWith('/database')) {
    return '/database';
  }

  return '';
};

const LayoutComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSeason, setCurrentSeason, sidebarCollapsed, toggleSidebar } = useAppStore();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [searchActivated, setSearchActivated] = useState(false);
  const { seasons } = useSeasons();
  const initialCheckDone = useRef(false);
  const activeNavKey = resolveActiveNavKey(location.pathname);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    setMounted(true);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (initialCheckDone.current) {
      return;
    }

    initialCheckDone.current = true;

    const navigationEntries = performance.getEntriesByType('navigation');
    if (navigationEntries.length > 0) {
      const navType = (navigationEntries[0] as PerformanceNavigationTiming).type;
      if (navType === 'navigate' && location.pathname !== '/') {
        navigate('/', { replace: true });
      }
    }
  }, [location.pathname, navigate]);

  useEffect(() => {
    const connection = (navigator as NavigatorWithConnection).connection;
    if (connection?.saveData) {
      return undefined;
    }

    const preloadSearch = () => {
      void import('@/hooks/useGlobalSearch')
        .then(({ preloadGlobalSearchIndex }) => preloadGlobalSearchIndex())
        .catch(() => {
          // Search still loads on demand if idle preloading fails.
        });
    };

    const idleWindow = window as WindowWithIdleCallback;
    if (idleWindow.requestIdleCallback) {
      const idleHandle = idleWindow.requestIdleCallback(preloadSearch, { timeout: 4000 });
      return () => idleWindow.cancelIdleCallback?.(idleHandle);
    }

    const timeoutId = window.setTimeout(preloadSearch, 1800);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const handleMenuClick = (key: string) => {
    navigate(key);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 100;
    if (touchEndX < touchStartX - swipeThreshold && mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
    setTouchStartX(0);
    setTouchEndX(0);
  };

  const activateSearch = () => {
    setSearchActivated(true);
  };

  const searchBox = searchActivated ? (
    <Suspense fallback={<div className="search-loading-shell">{TEXT.searching}</div>}>
      <GlobalSearchBox autoFocus mobileOptimized={isMobile} />
    </Suspense>
  ) : (
    <button
      type="button"
      className="search-trigger"
      onClick={activateSearch}
      onFocus={activateSearch}
      onMouseEnter={() => void import('@/components/GlobalSearchBox')}
      aria-label={TEXT.searchPlaceholder}
    >
      <SearchIcon className="search-trigger-icon" />
      <span className="search-trigger-text">{TEXT.searchPlaceholder}</span>
    </button>
  );

  return (
    <div className="app-layout">
      {isMobile && mounted ? (
        <div
          className={`sidebar-overlay ${mobileSidebarOpen ? 'visible' : ''}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      {mounted ? (
        <aside
          className={`sidebar ${!isMobile ? 'desktop-mounted' : ''} ${!isMobile && sidebarCollapsed ? 'collapsed' : ''} ${isMobile && mobileSidebarOpen ? 'mobile-open' : ''}`}
          onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
          onTouchMove={(event) => setTouchEndX(event.touches[0].clientX)}
          onTouchEnd={handleTouchEnd}
        >
          <div className="sidebar-logo">
            {isMobile ? TEXT.appName : (sidebarCollapsed ? 'F1' : TEXT.appName)}
          </div>

          <nav className="sidebar-nav" aria-label={TEXT.appName}>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeNavKey === item.key;

              return (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar-nav-button ${isActive ? 'is-active' : ''}`}
                  onClick={() => handleMenuClick(item.key)}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="sidebar-nav-icon" />
                  <span className="sidebar-nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      ) : null}

      <div
        className={`main-layout ${!mounted ? 'sidebar-hidden' : ''} ${mounted && !isMobile && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      >
        <header className={`header ${isMobile ? 'mobile-header' : ''}`}>
          <div className="header-main">
            <div className="header-left">
              <button
                type="button"
                onClick={isMobile ? () => setMobileSidebarOpen((previous) => !previous) : toggleSidebar}
                className="menu-toggle-btn"
                aria-label={mobileSidebarOpen || !sidebarCollapsed
                  ? '\u6536\u8d77\u4fa7\u8fb9\u680f'
                  : '\u5c55\u5f00\u4fa7\u8fb9\u680f'}
              >
                {isMobile
                  ? (mobileSidebarOpen ? <MenuFoldIcon className="menu-toggle-icon" /> : <MenuUnfoldIcon className="menu-toggle-icon" />)
                  : (sidebarCollapsed ? <MenuUnfoldIcon className="menu-toggle-icon" /> : <MenuFoldIcon className="menu-toggle-icon" />)}
              </button>

              <label className="season-switcher">
                <span className="season-label">{TEXT.currentSeason}</span>
                <select
                  value={currentSeason}
                  onChange={(event) => setCurrentSeason(event.target.value)}
                  className="season-select-native"
                >
                  {seasons.map((season) => (
                    <option key={season.season} value={season.season}>
                      {season.season}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!isMobile ? (
              <div className="header-search-slot">
                {searchBox}
              </div>
            ) : null}
          </div>

          {isMobile ? (
            <div className="header-mobile-search">
              {searchBox}
            </div>
          ) : null}
        </header>

        <main className="content">
          <div className="content-inner">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default LayoutComponent;
