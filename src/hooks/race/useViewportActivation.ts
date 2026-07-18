import { useEffect, useRef } from 'react';

interface ViewportActivationOptions {
  enabled: boolean;
  onActivate: () => void;
  rootMargin?: string;
}

export function useViewportActivation({
  enabled,
  onActivate,
  rootMargin = '320px 0px',
}: ViewportActivationOptions) {
  const targetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = targetRef.current;
    if (!enabled || !element) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      onActivate();
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        onActivate();
        observer.disconnect();
      }
    }, { rootMargin });
    observer.observe(element);
    return () => observer.disconnect();
  }, [enabled, onActivate, rootMargin]);

  return targetRef;
}
