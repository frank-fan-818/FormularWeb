import { describe, expect, it, vi } from 'vitest';
import { FiaSourceUnavailableError, requestFiaDocument } from './fiaDocumentSource';

describe('public FIA source failures', () => {
  it('classifies public access denial without retrying or fabricating content', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 403 }));
    await expect(requestFiaDocument('https://www.fia.com/documents', r => r.text(), fetcher)).rejects.toBeInstanceOf(FiaSourceUnavailableError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects untrusted hosts before a request', async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(requestFiaDocument('https://evil.test/documents', r => r.text(), fetcher)).rejects.toThrow('Untrusted');
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('does not downgrade malformed documents or credential errors', async () => {
    await expect(requestFiaDocument('https://www.fia.com/documents', r => r.json(),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('<html>wrong</html>')))).rejects.toBeInstanceOf(SyntaxError);
    await expect(requestFiaDocument('https://www.fia.com/documents', r => r.text(),
      vi.fn<typeof fetch>().mockResolvedValue(new Response('', { status: 401 })))).rejects.not.toBeInstanceOf(FiaSourceUnavailableError);
  });
});
