import { describe, expect, it } from 'vitest';
import { ensureLanguageResources, interpolateTranslation, normalizeLanguage, translate } from './i18n';

describe('lightweight i18n runtime', () => {
  it('normalizes supported English variants and falls back to Chinese', () => {
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('zh-Hans')).toBe('zh-CN');
    expect(normalizeLanguage('unsupported')).toBe('zh-CN');
  });

  it('translates in both supported languages', async () => {
    await ensureLanguageResources('en');
    expect(translate('zh-CN', 'home')).toBe('首页');
    expect(translate('en', 'home')).toBe('Home');
  });

  it('interpolates parameters without discarding unresolved placeholders', () => {
    expect(translate('en', 'daysRemaining', { days: 3 })).toBe('3 days remaining');
    expect(interpolateTranslation('{{ known }} / {{missing}}', { known: 1 })).toBe('1 / {{missing}}');
  });

  it('uses the Chinese resource and then the key as deterministic fallbacks', async () => {
    await ensureLanguageResources('en');
    expect(translate('en', 'settingsChinese')).toBe('中文');
    expect(translate('en', 'missing.translation.key')).toBe('missing.translation.key');
  });
});
