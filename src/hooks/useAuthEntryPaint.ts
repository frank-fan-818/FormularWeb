import { useEffect } from 'react';

/** Let a bare first visit paint its public account UI before session SDK work. */
export function useAuthEntryPaint() {
  useEffect(() => {
    let active = true;
    let frame = requestAnimationFrame(() => {
      void (document.fonts?.ready ?? Promise.resolve()).then(() => {
        if (!active) return;
        frame = requestAnimationFrame(() => {
          if (active) window.dispatchEvent(new Event('f1-auth-entry-painted'));
        });
      });
    });
    return () => { active = false; cancelAnimationFrame(frame); };
  }, []);
}
