import { Suspense, lazy } from 'react';
import { Spin } from 'antd';
import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';

const Seasons = lazy(() => import('@/pages/Seasons'));
const Races = lazy(() => import('@/pages/Races'));
const RaceDetail = lazy(() => import('@/pages/RaceDetail'));
const Drivers = lazy(() => import('@/pages/Drivers'));
const DriverDetail = lazy(() => import('@/pages/DriverDetail'));
const DriverHistoryDetail = lazy(() => import('@/pages/DriverHistoryDetail'));
const Constructors = lazy(() => import('@/pages/Constructors'));
const ConstructorDetail = lazy(() => import('@/pages/ConstructorDetail'));
const ConstructorHistoryDetail = lazy(() => import('@/pages/ConstructorHistoryDetail'));
const Circuits = lazy(() => import('@/pages/Circuits'));
const CircuitDetail = lazy(() => import('@/pages/CircuitDetail'));
const DatabaseAudit = lazy(() => import('@/pages/DatabaseAudit'));

function withSuspense(element: JSX.Element) {
  return (
    <Suspense
      fallback={(
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px 24px' }}>
          <Spin size="large" />
        </div>
      )}
    >
      {element}
    </Suspense>
  );
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      {
        path: '/',
        element: <Home />,
      },
      {
        path: '/seasons',
        element: withSuspense(<Seasons />),
      },
      {
        path: '/races',
        element: withSuspense(<Races />),
      },
      {
        path: '/races/:round',
        element: withSuspense(<RaceDetail />),
      },
      {
        path: '/drivers',
        element: withSuspense(<Drivers />),
      },
      {
        path: '/drivers/:driverId',
        element: withSuspense(<DriverDetail />),
      },
      {
        path: '/history/drivers/:driverId',
        element: withSuspense(<DriverHistoryDetail />),
      },
      {
        path: '/constructors',
        element: withSuspense(<Constructors />),
      },
      {
        path: '/constructors/:constructorId',
        element: withSuspense(<ConstructorDetail />),
      },
      {
        path: '/history/constructors/:constructorId',
        element: withSuspense(<ConstructorHistoryDetail />),
      },
      {
        path: '/circuits',
        element: withSuspense(<Circuits />),
      },
      {
        path: '/circuits/:circuitId',
        element: withSuspense(<CircuitDetail />),
      },
      {
        path: '/database',
        element: withSuspense(<DatabaseAudit />),
      },
    ],
  },
]);

export default router;
