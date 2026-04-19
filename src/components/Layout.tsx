import { useState, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { Layout, Menu, Select, Button, AutoComplete, Input, Spin } from 'antd';
import type { DefaultOptionType } from 'antd/es/select';
import {
  HomeOutlined,
  CalendarOutlined,
  TrophyOutlined,
  CarOutlined,
  TeamOutlined,
  FlagOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppStore } from '@/store';
import { seasonApi } from '@/api/ergast';
import { useGlobalSearch } from '@/hooks';
import type { Season } from '@/types';
import './Layout.css';

const { Sider, Header, Content } = Layout;
const { Option } = Select;

interface SearchOption extends DefaultOptionType {
  route?: string;
}

const LayoutComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSeason, setCurrentSeason, sidebarCollapsed, toggleSidebar } = useAppStore();
  const [seasons, setSeasons] = useState<Season[]>([]);
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

  useEffect(() => {
    const loadSeasons = async () => {
      const data = await seasonApi.getAllSeasons();
      setSeasons(data.reverse());
    };
    void loadSeasons();
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    setMounted(true);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const initialCheckDone = useRef(false);

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
  }, [navigate, location.pathname]);

  const handleMenuClick = (key: string) => {
    navigate(key);
    if (isMobile) {
      setMobileSidebarOpen(false);
    }
  };

  const toggleMobileSidebar = () => {
    setMobileSidebarOpen((previous) => !previous);
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    setTouchStartX(event.touches[0].clientX);
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    setTouchEndX(event.touches[0].clientX);
  };

  const handleTouchEnd = () => {
    const swipeThreshold = 100;
    if (touchEndX < touchStartX - swipeThreshold && mobileSidebarOpen) {
      setMobileSidebarOpen(false);
    }
    setTouchStartX(0);
    setTouchEndX(0);
  };

  const menuItems = [
    {
      key: '/',
      icon: <HomeOutlined />,
      label: '首页',
    },
    {
      key: '/seasons',
      icon: <CalendarOutlined />,
      label: '赛季中心',
    },
    {
      key: '/races',
      icon: <TrophyOutlined />,
      label: '分站赛事',
    },
    {
      key: '/drivers',
      icon: <CarOutlined />,
      label: '车手库',
    },
    {
      key: '/constructors',
      icon: <TeamOutlined />,
      label: '车队库',
    },
    {
      key: '/circuits',
      icon: <FlagOutlined />,
      label: '赛道库',
    },
  ];

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

  const handleSearch = (value: string) => {
    setSearchValue(value);
    void runSearch(value);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (!value) {
      reset();
    }
  };

  const handleSearchSelect = (_value: string, option: SearchOption) => {
    if (option.route) {
      navigate(option.route);
    }
    setSearchValue('');
    reset();
  };

  const notFoundContent: ReactNode = searchLoading ? (
    <div className="global-search-feedback">
      <Spin size="small" />
      <span>Searching...</span>
    </div>
  ) : searchError ? (
    <div className="global-search-feedback error">Search is temporarily unavailable.</div>
  ) : searchValue.trim() ? (
    <div className="global-search-feedback">No matching drivers, teams, or circuits.</div>
  ) : null;

  const searchBox = (
    <AutoComplete
      className="global-search"
      value={searchValue}
      options={searchOptions}
      onSearch={handleSearch}
      onChange={handleSearchChange}
      onSelect={handleSearchSelect}
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
        placeholder="Search drivers, teams, circuits"
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
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="sidebar-logo">
            {isMobile ? 'F1 数据看板' : (sidebarCollapsed ? 'F1' : 'F1 数据看板')}
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
                onClick={isMobile ? toggleMobileSidebar : toggleSidebar}
                size="large"
                className="menu-toggle-btn"
              />
              <div className="season-switcher">
                <span className="season-label">当前赛季</span>
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
