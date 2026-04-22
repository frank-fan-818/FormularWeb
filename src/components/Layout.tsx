import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { Button, Layout, Menu, Select } from 'antd';
import {
  CalendarOutlined,
  CarOutlined,
  DatabaseOutlined,
  FlagOutlined,
  HomeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  TeamOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useSeasons } from '@/hooks';
import { useAppStore } from '@/store';
import './Layout.css';

const { Content, Header, Sider } = Layout;
const { Option } = Select;
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

const menuItems = [
  { key: '/', icon: <HomeOutlined />, label: TEXT.home },
  { key: '/seasons', icon: <CalendarOutlined />, label: TEXT.seasonStandings },
  { key: '/races', icon: <TrophyOutlined />, label: TEXT.races },
  { key: '/drivers', icon: <CarOutlined />, label: TEXT.drivers },
  { key: '/constructors', icon: <TeamOutlined />, label: TEXT.constructors },
  { key: '/circuits', icon: <FlagOutlined />, label: TEXT.circuits },
  { key: '/database', icon: <DatabaseOutlined />, label: TEXT.databaseAudit },
];

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
      <GlobalSearchBox autoFocus />
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
      <SearchOutlined />
      <span className="search-trigger-text">{TEXT.searchPlaceholder}</span>
    </button>
  );

  return (
    <Layout className="app-layout">
      {isMobile && mounted ? (
        <div
          className={`sidebar-overlay ${mobileSidebarOpen ? 'visible' : ''}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      {mounted ? (
        <Sider
          trigger={null}
          collapsible
          collapsed={isMobile ? false : sidebarCollapsed}
          className={`sidebar ${!isMobile ? 'desktop-mounted' : ''} ${isMobile && mobileSidebarOpen ? 'mobile-open' : ''}`}
          onTouchStart={(event) => setTouchStartX(event.touches[0].clientX)}
          onTouchMove={(event) => setTouchEndX(event.touches[0].clientX)}
          onTouchEnd={handleTouchEnd}
        >
          <div className="sidebar-logo">
            {isMobile ? TEXT.appName : (sidebarCollapsed ? 'F1' : TEXT.appName)}
          </div>

          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => handleMenuClick(key)}
            className="sidebar-menu"
          />
        </Sider>
      ) : null}

      <Layout
        className={`main-layout ${!mounted ? 'sidebar-hidden' : ''} ${mounted && !isMobile && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      >
        <Header className={`header ${isMobile ? 'mobile-header' : ''}`}>
          <div className="header-main">
            <div className="header-left">
              <Button
                type="text"
                icon={isMobile
                  ? (mobileSidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />)
                  : (sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
                onClick={isMobile ? () => setMobileSidebarOpen((previous) => !previous) : toggleSidebar}
                size="large"
                className="menu-toggle-btn"
              />

              <div className="season-switcher">
                <span className="season-label">{TEXT.currentSeason}</span>
                <Select
                  value={currentSeason}
                  onChange={setCurrentSeason}
                  className="season-select"
                  size="large"
                >
                  {seasons.map((season) => (
                    <Option key={season.season} value={season.season}>
                      {season.season}
                    </Option>
                  ))}
                </Select>
              </div>
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
        </Header>

        <Content className="content">
          <div className="content-inner">
            <Outlet />
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default LayoutComponent;
