import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SearchResultGroup } from '@/types';
import GlobalSearchBox from './GlobalSearchBox';

const search = vi.hoisted(() => ({
  groups: [] as SearchResultGroup[],
  loading: false,
  error: null as string | null,
  ensureLoaded: vi.fn().mockResolvedValue([]),
  runSearch: vi.fn(),
  reset: vi.fn(),
}));

vi.mock('@/hooks/useGlobalSearch', () => ({ useGlobalSearch: () => search }));
vi.mock('@/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));

describe('global search query feedback', () => {
  let renderer: ReactTestRenderer;
  const dropdowns = () => renderer.root.findAll((node) =>
    typeof node.props.className === 'string' && node.props.className.includes('global-search-dropdown'));
  const input = () => renderer.root.findByType('input');
  const typeQuery = (value: string) => act(() => input().props.onChange({ target: { value } }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('window', { setTimeout, clearTimeout });
    search.groups = [];
    search.loading = false;
    search.error = null;
    vi.clearAllMocks();
  });

  afterEach(() => {
    act(() => renderer?.unmount());
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it.each(['loading', 'error'] as const)('keeps empty focused input idle during preload %s', (state) => {
    search.loading = state === 'loading';
    search.error = state === 'error' ? 'Preload unavailable' : null;
    act(() => { renderer = create(<GlobalSearchBox autoFocus />); });
    act(() => { vi.advanceTimersByTime(0); });
    act(() => input().props.onFocus());

    expect(search.ensureLoaded).toHaveBeenCalled();
    expect(dropdowns()).toHaveLength(0);
    expect(input().props['aria-expanded']).toBe(false);
    expect(renderer.root.findAllByProps({ className: 'global-search-input-wrap has-error' })).toHaveLength(0);
    expect(search.runSearch).not.toHaveBeenCalled();
  });

  it('hides loading feedback for whitespace and immediately after clearing', () => {
    search.loading = true;
    act(() => { renderer = create(<GlobalSearchBox />); });
    typeQuery('   ');
    expect(dropdowns()).toHaveLength(0);

    typeQuery('Max');
    expect(dropdowns()).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain('searching');
    expect(input().props['aria-expanded']).toBe(true);

    act(() => renderer.root.findByType('button').props.onClick());
    expect(dropdowns()).toHaveLength(0);
    expect(input().props['aria-expanded']).toBe(false);
  });

  it.each([
    { loading: true, error: null, label: 'searching' },
    { loading: false, error: 'Unavailable', label: 'searchUnavailable' },
    { loading: false, error: null, label: 'noSearchResults' },
  ])('preserves $label feedback for a nonempty query', ({ loading, error, label }) => {
    search.loading = loading;
    search.error = error;
    act(() => { renderer = create(<GlobalSearchBox />); });
    typeQuery('Max');
    act(() => { vi.advanceTimersByTime(120); });

    expect(search.runSearch).toHaveBeenCalledWith('Max');
    expect(dropdowns()).toHaveLength(1);
    expect(JSON.stringify(renderer.toJSON())).toContain(label);
  });

  it('shows results only while there is a query, even if a previous request completes after clearing', () => {
    act(() => { renderer = create(<GlobalSearchBox />); });
    typeQuery('Max');
    search.groups = [{ type: 'driver', items: [{
      type: 'driver', id: 'max_verstappen', title: 'Max Verstappen', subtitle: 'Dutch',
      route: '/drivers/max_verstappen', keywords: ['Max'],
    }] }];
    act(() => renderer.update(<GlobalSearchBox />));
    expect(renderer.root.findAllByProps({ role: 'option' })).toHaveLength(1);

    typeQuery('');
    expect(dropdowns()).toHaveLength(0);
    expect(input().props['aria-expanded']).toBe(false);
  });
});
