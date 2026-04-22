import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AutoComplete, Button, Input, Layout, Menu, Select, Spin } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
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
import { useGlobalSearch, useSeasons } from '@/hooks';
import { useAppStore } from '@/store';
import './Layout.css';

const { Content, Header, Sider } = Layout;
const { Option } = Select;

const TEXT = {
  home: '首页',
  seasonStandings: '赛季积分榜',
  races: '分站赛事',
  drivers: '车手',
  constructors: '车队',
  circuits: '赛道',
  databaseAudit: '数据库审计',
  searching: '搜索中...',
  searchUnavailable: '搜索暂时不可用。',
  noSearchResults: '没有找到匹配的车手、车队或赛道。',
  searchPlaceholder: '搜索车手、车队、赛道',
  appName: 'F1 数据中心',
  currentSeason: '当前赛季',
};

interface SearchOption extends DefaultOptionType {
  route?: string;
}

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
  const [searchValue, setSearchValue] = useState('');
  const {
    groups,
    loading: searchLoading,
    error: searchError,
    ensureLoaded,
    runSearch,
    reset,
  } = useGlobalSearch();
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

  const searchOptions: SearchOption[] = groups.map((group) => ({
    label: <span className="search-group-label">{group.label}</span>,
    options: group.items.map((item) => ({
      value: `${item.type}:${item.id}`,
      route: item.route,
      label: (
        <div className="global-search-option">
          <div className="global-search-option-title">{item.title}</div>
          {item.subtitle ? (
            <div className="global-search-option-subtitle">{item.subtitle}</div>
          ) : null}
        </div>
      ),
    })),
  }));

  const notFoundContent: ReactNode = searchLoading ? (
    <div className="global-search-feedback">
      <Spin size="small" />
      <span>{TEXT.searching}</span>
    </div>
  ) : searchError ? (
    <div className="global-search-feedback error">{TEXT.searchUnavailable}</div>
  ) : searchValue.trim() ? (
    <div className="global-search-feedback">{TEXT.noSearchResults}</div>
  ) : null;

  const searchBox = (
    <AutoComplete
      className="global-search"
      value={searchValue}
      options={searchOptions}
      onSearch={(value) => {
        setSearchValue(value);
        void runSearch(value);
      }}
      onChange={(value) => {
        setSearchValue(value);
        if (!value) {
          reset();
        }
      }}
      onSelect={(_value, option: SearchOption) => {
        if (option.route) {
          navigate(option.route);
        }
        setSearchValue('');
        reset();
      }}
      onFocus={() => {
        void ensureLoaded();
      }}
      notFoundContent={notFoundContent}
      popupClassName="global-search-dropdown"
    >
      <Input
        allowClear
        size="large"
        prefix={<SearchOutlined />}
        placeholder={TEXT.searchPlaceholder}
        status={searchError ? 'error' : undefined}
      />
    </AutoComplete>
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
