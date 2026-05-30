import { Suspense, lazy, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  searching: '\u52a0\u8f7d\u641c\u7d22\u4e2d...',
  searchPlaceholder: '\u641c\u7d22\u8f66\u624b\u3001\u8f66\u961f\u6216\u8d5b\u9053',
  appName: 'F1 \u6570\u636e\u4e2d\u5fc3',
  currentSeason: '\u5f53\u524d\u8d5b\u5b63',
  settings: '\u8bbe\u7f6e',
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

const SunIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <circle cx="12" cy="12" r="5" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </IconBase>
);

const MoonIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </IconBase>
);

const SystemIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8" />
    <path d="M12 17v4" />
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

const MonitorIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <circle cx="6.5" cy="9.5" r="2.5" />
    <path d="M4 17.5a4.5 4.5 0 0 1 5-4.4" />
    <path d="M12 7.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
    <path d="M13.5 15.5a3 3 0 1 1 6 0 3 3 0 0 1-6 0Z" />
    <path d="m11 21.5 4-3.5 4 3.5" />
  </IconBase>
);

const SettingIcon = ({ className }: IconProps) => (
  <IconBase className={className}>
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </IconBase>
);

const navItems = [
  { key: '/', icon: HomeIcon, label: TEXT.home },
  { key: '/seasons', icon: SeasonIcon, label: TEXT.seasonStandings },
  { key: '/races', icon: RaceIcon, label: TEXT.races },
  { key: '/drivers', icon: DriverIcon, label: TEXT.drivers },
  { key: '/constructors', icon: ConstructorIcon, label: TEXT.constructors },
  { key: '/circuits', icon: CircuitIcon, label: TEXT.circuits },
  { key: '/settings', icon: SettingIcon, label: TEXT.settings },
  { key: '/monitor', icon: MonitorIcon, label: '\u8fd0\u884c\u76d1\u63a7' },
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

  if (pathname.startsWith('/monitor')) {
    return '/monitor';
  }

  return '';
};

const LayoutComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSeason, setCurrentSeason, sidebarCollapsed, toggleSidebar, theme, setTheme } = useAppStore();
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [searchActivated, setSearchActivated] = useState(false);
  const { seasons } = useSeasons();
  const { i18n } = useTranslation();
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

  const searchTrigger = (
    <button
      type="button"
      className={`search-trigger ${isMobile ? 'mobile-search-trigger' : ''}`}
      onClick={activateSearch}
      onFocus={activateSearch}
      onMouseEnter={() => void import('@/components/GlobalSearchBox')}
      aria-label={TEXT.searchPlaceholder}
    >
      <SearchIcon className="search-trigger-icon" />
      <span className="search-trigger-text">{TEXT.searchPlaceholder}</span>
    </button>
  );

  const searchBox = searchActivated ? (
    <Suspense fallback={<div className="search-loading-shell">{TEXT.searching}</div>}>
      <GlobalSearchBox autoFocus mobileOptimized={isMobile} />
    </Suspense>
  ) : searchTrigger;

  const seasonSwitcher = (
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
  );

  const langSwitcher = (
    <label className="season-switcher lang-switcher">
      <select
        value={i18n.language}
        onChange={(event) => {
          i18n.changeLanguage(event.target.value);
          localStorage.setItem('i18nextLng', event.target.value);
        }}
        className="season-select-native"
      >
        <option value="zh-CN">中文</option>
        <option value="en">EN</option>
      </select>
    </label>
  );

  const cycleTheme = () => {
    const order: Array<'system' | 'light' | 'dark'> = ['system', 'light', 'dark'];
    const currentIndex = order.indexOf(theme);
    const nextTheme = order[(currentIndex + 1) % order.length];
    setTheme(nextTheme);
  };

  const themeIcon = theme === 'dark' ? <MoonIcon /> : theme === 'light' ? <SunIcon /> : <SystemIcon />;

  const themeToggle = (
    <button
      type="button"
      onClick={cycleTheme}
      className="theme-toggle-btn"
      aria-label={`Theme: ${theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}`}
    >
      {themeIcon}
    </button>
  );

  const menuButton = (
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
              {isMobile ? (
                <>
                  {seasonSwitcher}
                  {langSwitcher}
                  <div className="header-mobile-actions">
                    {themeToggle}
                    {!searchActivated ? searchTrigger : null}
                    {menuButton}
                  </div>
                </>
              ) : (
                <>
                  {menuButton}
                  {seasonSwitcher}
                  {langSwitcher}
                  {themeToggle}
                </>
              )}
            </div>

            {!isMobile ? (
              <div className="header-search-slot">
                {searchBox}
              </div>
            ) : null}
          </div>

          {isMobile && searchActivated ? (
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
