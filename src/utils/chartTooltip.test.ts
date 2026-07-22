import { describe, expect, it } from 'vitest';
import { escapeHtml } from './chartTooltip';

describe('escapeHtml', () => {
  it('escapes text before it is interpolated into an HTML tooltip', () => {
    expect(escapeHtml('<img src=x onerror="alert(1)"> & \'race\''))
      .toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;race&#39;');
  });
});
