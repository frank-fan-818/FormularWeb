import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { TableProps } from 'antd';
import { TimingBeacon } from '@/components/loading/TimingBeacon';

const DeferredAntTable = lazy(() => import('./DeferredAntTable'));

export default function ViewportTable<T extends object>(props: TableProps<T>) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const element = anchorRef.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '320px 0px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <div ref={anchorRef} className="viewport-table-anchor">
      {visible ? (
        <Suspense fallback={<TimingBeacon variant="inline" label="正在加载表格" />}>
          <DeferredAntTable {...(props as unknown as TableProps<object>)} />
        </Suspense>
      ) : (
        <TimingBeacon variant="inline" label="表格将在接近视口时加载" />
      )}
    </div>
  );
}
