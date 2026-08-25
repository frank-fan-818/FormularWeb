import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { TimingBeacon } from './TimingBeacon';

describe('TimingBeacon', () => {
  it('renders an accessible loading status with supplied context', () => {
    const markup = renderToStaticMarkup(
      <TimingBeacon variant="page" label="Loading race control" detail="Preparing the next data view" />,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
    expect(markup).toContain('data-loading-variant="page"');
    expect(markup).toContain('Loading race control');
    expect(markup).toContain('Preparing the next data view');
  });

  it('keeps the inline variant compact by omitting the stage legend', () => {
    const markup = renderToStaticMarkup(<TimingBeacon variant="inline" />);

    expect(markup).toContain('timing-beacon--inline');
    expect(markup).not.toContain('REQUEST');
  });
});
