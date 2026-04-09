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

  useEffect(() => {
    const loadSeasons = async () => {
      const data = await seasonApi.getAllSeasons();
      setSeasons(data.reverse());
    };
    loadSeasons();
  }, []);

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
      <Sider
        trigger={null}
        collapsible
        collapsed={sidebarCollapsed}
        className="sidebar"
      >
        <div className="sidebar-logo">
          {sidebarCollapsed ? 'F1' : 'F1 数据看板'}
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          className="sidebar-menu"
        />
      </Sider>
      <Layout className={`main-layout ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header className="header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={toggleSidebar}
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
