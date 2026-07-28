function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
}

function decodeRepeatedly(value: string): string {
  let decoded = value;

  for (let index = 0; index < 3; index += 1) {
    try {
      const next = decodeURIComponent(decoded);
      if (next === decoded) break;
      decoded = next;
    } catch {
      return '';
    }
  }

  return decoded;
}

/**
 * Accepts only same-origin, root-relative application routes.
 *
 * React Router 6 cannot safely distinguish every backslash-shaped external
 * destination, so persisted or otherwise untrusted navigation targets must
 * pass this boundary before they reach `navigate`.
 */
export function isSafeInternalRoute(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/')) return false;

  const decoded = decodeRepeatedly(value);
  if (
    !decoded
    || decoded.startsWith('//')
    || decoded.includes('\\')
    || hasControlCharacters(decoded)
  ) {
    return false;
  }

  try {
    const parsed = new URL(value, 'https://f1-dashboard.invalid');
    return parsed.origin === 'https://f1-dashboard.invalid'
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}
