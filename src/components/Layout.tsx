import { useState, useEffect } from 'react';
import { Layout, Menu, Select, Button } from 'antd';
import {
  HomeOutlined,
  CalendarOutlined,
  TrophyOutlined,
  CarOutlined,
  TeamOutlined,
  FlagOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAppStore } from '@/store';
import { seasonApi } from '@/api/ergast';
import type { Season } from '@/types';
import './Layout.css';

const { Sider, Header, Content } = Layout;
const { Option } = Select;

const LayoutComponent = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { currentSeason, setCurrentSeason, sidebarCollapsed, toggleSidebar } = useAppStore();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const loadSeasons = async () => {
      const data = await seasonApi.getAllSeasons();
      setSeasons(data.reverse());
    };
    loadSeasons();
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

  useEffect(() => {
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
    setMobileSidebarOpen(!mobileSidebarOpen);
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

  return (
    <Layout className="app-layout">
      {isMobile && mounted && (
        <div
          className={`sidebar-overlay ${mobileSidebarOpen ? 'visible' : ''}`}
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      {mounted && (
        <Sider
          trigger={null}
          collapsible
          collapsed={isMobile ? false : sidebarCollapsed}
          className={`sidebar ${!isMobile ? 'desktop-mounted' : ''} ${isMobile && mobileSidebarOpen ? 'mobile-open' : ''}`}
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
      )}
      <Layout className={`main-layout ${!mounted ? 'sidebar-hidden' : ''} ${mounted && !isMobile && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={isMobile ? (mobileSidebarOpen ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />) : (sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />)}
              onClick={isMobile ? toggleMobileSidebar : toggleSidebar}
              size="large"
              className="menu-toggle-btn"
            />
            <span className="season-label">当前赛季：</span>
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
