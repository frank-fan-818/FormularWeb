import { describe, expect, it } from 'vitest';
import { syncDocumentHead } from '@/utils/documentHead';

interface FakeMeta {
  name: string;
  content: string;
  remove: () => void;
}

function createFakeDocument() {
  const metas = new Map<string, FakeMeta>();
  const fakeDocument = {
    title: '',
    head: {
      appendChild(meta: FakeMeta) {
        metas.set(meta.name, meta);
      },
    },
    createElement() {
      const meta: FakeMeta = {
        name: '',
        content: '',
        remove() {
          metas.delete(meta.name);
        },
      };
      return meta;
    },
    querySelector(selector: string) {
      const name = selector.match(/meta\[name="([^"]+)"\]/)?.[1] || '';
      return metas.get(name) ?? null;
    },
  };

  return { fakeDocument, metas };
}

describe('syncDocumentHead', () => {
  it('updates the title and creates managed metadata', () => {
    const { fakeDocument, metas } = createFakeDocument();

    syncDocumentHead(
      { title: 'Race — F1', description: 'Race intelligence', robots: 'noindex' },
      fakeDocument as unknown as Document,
    );

    expect(fakeDocument.title).toBe('Race — F1');
    expect(metas.get('description')?.content).toBe('Race intelligence');
    expect(metas.get('robots')?.content).toBe('noindex');
  });

  it('removes stale optional metadata when navigating away', () => {
    const { fakeDocument, metas } = createFakeDocument();
    syncDocumentHead(
      { title: 'Missing', description: 'Missing page', robots: 'noindex' },
      fakeDocument as unknown as Document,
    );

    syncDocumentHead(
      { title: 'Home', description: 'Season overview' },
      fakeDocument as unknown as Document,
    );

    expect(metas.get('description')?.content).toBe('Season overview');
    expect(metas.has('robots')).toBe(false);
  });
});
