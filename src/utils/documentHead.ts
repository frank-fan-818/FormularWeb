export interface DocumentHeadState {
  title: string;
  description?: string;
  robots?: string;
}

function syncMeta(
  name: 'description' | 'robots',
  content: string | undefined,
  target: Document,
): void {
  const existing = target.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!content) {
    existing?.remove();
    return;
  }

  const meta = existing ?? target.createElement('meta');
  meta.name = name;
  meta.content = content;
  if (!existing) target.head.appendChild(meta);
}

export function syncDocumentHead(
  { title, description, robots }: DocumentHeadState,
  target: Document = document,
): void {
  target.title = title;
  syncMeta('description', description, target);
  syncMeta('robots', robots, target);
}
