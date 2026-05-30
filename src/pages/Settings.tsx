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
              <Link href="https://api.jolpi.ca/ergast/" target="_blank">
                Jolpica / Ergast
              </Link>
              <Link href="https://github.com/theOehrly/Fast-F1" target="_blank">
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
