import { useTranslation } from 'react-i18next';
import {
  Card, Segmented, Select, Switch, Typography, Space, Divider,
} from 'antd';
import {
  SettingOutlined,
  BgColorsOutlined,
  DatabaseOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useAppStore } from '@/store';
import { useSeasons } from '@/hooks';
import { version } from '../../package.json';
import type { ThemeMode } from '@/store';
import ProductMasthead from '@/components/product/ProductMasthead';
import './Settings.css';

const { Text, Link } = Typography;

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme, currentSeason, setCurrentSeason } = useAppStore();
  const { seasons } = useSeasons();

  const themeOptions: Array<{ label: string; value: ThemeMode }> = [
    { label: t('settingsSystem'), value: 'system' },
    { label: t('settingsLight'), value: 'light' },
    { label: t('settingsDark'), value: 'dark' },
  ];

  const languageOptions = [
    { label: t('settingsChinese'), value: 'zh-CN' },
    { label: t('settingsEnglish'), value: 'en' },
  ];

  const seasonOptions = seasons.map((s) => ({
    label: String(s.season),
    value: String(s.season),
  }));

  return (
    <div className="page-container settings-page">
      <ProductMasthead
        index="06"
        tone="utility"
        eyebrow="PREFERENCES / LOCAL"
        title="CONTROL SETTINGS"
        description="调整界面、语言与默认赛季。所有选项都围绕更快进入你最常查看的数据上下文。"
        metrics={[
          { label: '\u5f53\u524d\u8d5b\u5b63', value: currentSeason },
          { label: '\u754c\u9762\u4e3b\u9898', value: theme.toUpperCase() },
          { label: '\u8bed\u8a00', value: i18n.language === 'zh-CN' ? '\u4e2d\u6587' : 'ENGLISH' },
          { label: '\u7248\u672c', value: `v${version}` },
        ]}
      />
      <header className="settings-header">
        <h2>
          <SettingOutlined style={{ marginRight: 10, color: 'var(--f1-red)' }} />
          {t('settings')}
        </h2>
        <p className="settings-description">{t('settingsDescription')}</p>
      </header>

      <div className="settings-content">
        <Card
          title={(
            <Space>
              <BgColorsOutlined />
              <span>{t('settingsAppearance')}</span>
            </Space>
          )}
          className="settings-card"
        >
          <div className="setting-row">
            <div className="setting-label">
              <Text strong>{t('settingsTheme')}</Text>
            </div>
            <Segmented
              options={themeOptions}
              value={theme}
              onChange={(value) => setTheme(value as ThemeMode)}
            />
          </div>

          <Divider />

          <div className="setting-row">
            <div className="setting-label">
              <Text strong>{t('settingsLanguage')}</Text>
            </div>
            <Select
              value={i18n.language}
              onChange={(lang) => {
                i18n.changeLanguage(lang);
                localStorage.setItem('i18nextLng', lang);
              }}
              options={languageOptions}
              style={{ width: 160 }}
            />
          </div>
        </Card>

        <Card
          title={(
            <Space>
              <DatabaseOutlined />
              <span>{t('settingsDataPreferences')}</span>
            </Space>
          )}
          className="settings-card"
        >
          <div className="setting-row">
            <div className="setting-label">
              <Text strong>{t('settingsDefaultSeason')}</Text>
            </div>
            <Select
              value={currentSeason}
              onChange={setCurrentSeason}
              options={seasonOptions}
              style={{ width: 160 }}
            />
          </div>

          <Divider />

          <div className="setting-row">
            <div className="setting-label">
              <Text strong>{t('settingsDataSource')}</Text>
              <span className="setting-hint">{t('settingsCacheFirst')}</span>
            </div>
            <Switch defaultChecked />
          </div>
        </Card>

        <Card
          title={(
            <Space>
              <InfoCircleOutlined />
              <span>{t('settingsAbout')}</span>
            </Space>
          )}
          className="settings-card"
        >
          <div className="setting-row">
            <div className="setting-label">
              <Text strong>{t('settingsAppVersion')}</Text>
            </div>
            <Text code>{version}</Text>
          </div>

          <Divider />

          <div className="setting-row">
            <div className="setting-label">
              <Text strong>{t('settingsDataSources')}</Text>
            </div>
            <Space className="setting-links" size="middle">
              <Link href="https://api.jolpi.ca/ergast/" target="_blank" rel="noreferrer">
                Jolpica / Ergast
              </Link>
              <Link href="https://github.com/theOehrly/Fast-F1" target="_blank" rel="noreferrer">
                FastF1
              </Link>
            </Space>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Settings;
