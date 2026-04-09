import { useNavigate } from 'react-router-dom';
import { Row, Col, Card, Statistic, List, Tag, Spin } from 'antd';
import { TrophyOutlined, CarOutlined, TeamOutlined, ClockCircleOutlined, FireOutlined } from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useSeasonData, useRacesByStatus } from '@/hooks';
import dayjs from 'dayjs';

const Home = () => {
  const navigate = useNavigate();
  const { currentSeason } = useAppStore();
  const { driverStandings, constructorStandings, races, loading } = useSeasonData(currentSeason);
  const { ongoingRace, nextRace, completedRaces } = useRacesByStatus(races);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>🏎️ {currentSeason}赛季 F1 概览</h1>
        <p style={{ color: '#666' }}>欢迎来到F1数据看板，查看最新赛事数据和历史记录</p>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="已完成分站赛"
              value={completedRaces.length}
              prefix={<TrophyOutlined />}
              suffix={`/ ${races.length}`}
              valueStyle={{ color: '#ff1801' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="参赛车手"
              value={driverStandings.length}
              prefix={<CarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="参赛车队"
              value={constructorStandings.length}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            {nextRace ? (
              <Statistic
                title="下一场比赛"
                value={dayjs(nextRace.date).diff(dayjs(), 'day')}
                prefix={<ClockCircleOutlined />}
                suffix="天后"
                valueStyle={{ color: '#faad14' }}
              />
            ) : (
              <Statistic
                title="赛季已结束"
                value="完成"
                valueStyle={{ color: '#722ed1' }}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="🏆 车手积分榜 TOP3" variant="borderless">
            <List
              dataSource={driverStandings.slice(0, 3)}
              renderItem={(item, index) => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: index === 0 ? '#faad14' : index === 1 ? '#8c8c8c' : '#d48806',
                        width: 30
                      }}>
                        {index + 1}
                      </div>
                      <div>
                        <div
                          style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer' }}
                          onClick={() => navigate(`/drivers/${item.Driver.driverId}`)}
                        >
                          {item.Driver.givenName} {item.Driver.familyName}
                          <Tag color="blue" style={{ marginLeft: 8 }}>{item.Driver.code}</Tag>
                        </div>
                        <div
                          style={{ fontSize: 12, color: '#1890ff', cursor: 'pointer' }}
                          onClick={() => navigate(`/constructors/${item.Constructors[0].constructorId}`)}
                        >
                          {item.Constructors[0].name}
                        </div>
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff1801' }}>
                      {item.points} pts
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="🏭 车队积分榜 TOP3" variant="borderless">
            <List
              dataSource={constructorStandings.slice(0, 3)}
              renderItem={(item, index) => (
                <List.Item>
                  <div style={{ display: 'flex', alignItems: 'center', width: '100%', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{
                        fontSize: 24,
                        fontWeight: 'bold',
                        color: index === 0 ? '#faad14' : index === 1 ? '#8c8c8c' : '#d48806',
                        width: 30
                      }}>
                        {index + 1}
                      </div>
                      <div>
                        <div
                          style={{ fontWeight: 500, color: '#1890ff', cursor: 'pointer' }}
                          onClick={() => navigate(`/constructors/${item.Constructor.constructorId}`)}
                        >
                          {item.Constructor.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#666' }}>{item.Constructor.nationality}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff1801' }}>
                      {item.points} pts
                    </div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      {/* 进行中的比赛 */}
      {ongoingRace && (
        <Card
          title="🔥 进行中比赛"
          style={{ marginTop: 16, backgroundColor: '#fff7e6', borderColor: '#ffd591' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ margin: 0, color: '#d46b08' }}>{ongoingRace.raceName}</h3>
              <p style={{ margin: '8px 0 0', color: '#666' }}>
                {ongoingRace.Circuit.circuitName} · {ongoingRace.Circuit.Location.locality}, {ongoingRace.Circuit.Location.country}
              </p>
            </div>
            <Tag color="orange" icon={<FireOutlined />}>进行中</Tag>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Home;
