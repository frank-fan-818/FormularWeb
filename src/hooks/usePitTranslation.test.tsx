import { act, create } from 'react-test-renderer';
import { expect, it } from 'vitest';
import { usePitTranslation } from './usePitTranslation';

it('uses base translations for inherited object keys and interpolates stop numbers', () => {
  let translate!: ReturnType<typeof usePitTranslation>['t'];
  function Probe() { translate = usePitTranslation().t; return null; }
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  expect(translate('constructor')).toBe('车队');
  expect(translate('pitStopNumber', { n: 2 })).toBe('第 2 停');
  act(() => view.unmount());
});
