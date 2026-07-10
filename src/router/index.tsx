import { Suspense, lazy } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import Home from '@/pages/Home';

const Seasons = lazy(() => import('@/pages/Seasons'));
const Races = lazy(() => import('@/pages/Races'));
const RaceLayout = lazy(() => import('@/pages/Race/RaceLayout'));
const RaceResults = lazy(() => import('@/pages/Race/RaceResults'));
const RaceQualifying = lazy(() => import('@/pages/Race/RaceQualifying'));
const RaceAnalysis = lazy(() => import('@/pages/Race/RaceAnalysis'));
const RaceSprint = lazy(() => import('@/pages/Race/RaceSprint'));
const RaceInfo = lazy(() => import('@/pages/Race/RaceInfo'));
const Drivers = lazy(() => import('@/pages/Drivers'));
const DriverDetail = lazy(() => import('@/pages/DriverDetail'));
const Constructors = lazy(() => import('@/pages/Constructors'));
const ConstructorDetail = lazy(() => import('@/pages/ConstructorDetail'));
const ConstructorHistoryDetail = lazy(() => import('@/pages/ConstructorHistoryDetail'));
const Circuits = lazy(() => import('@/pages/Circuits'));
const CircuitDetail = lazy(() => import('@/pages/CircuitDetail'));
const Settings= lazy(() => import('@/pages/Settings'));
const Login = lazy(() => import('@/pages/Login'));

function withSuspense(element: JSX.Element) {
  return (
    <Suspense
      fallback={(
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '64px 24px',
          }}
        >
          <div
            aria-label="loading"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              border: '2px solid rgba(15, 23, 42, 0.16)',
              borderTopColor: 'var(--f1-red, #ff1801)',
              animation: 'route-spin 0.8s linear infinite',
            }}
          />
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
    element: <ErrorBoundary><Layout /></ErrorBoundary>,
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
        element: withSuspense(<RaceLayout />),
        children: [
          { index: true, element: <Navigate to="results" replace /> },
          { path: 'results', element: withSuspense(<RaceResults />) },
          { path: 'qualifying', element: withSuspense(<RaceQualifying />) },
          {
            path: 'race',
            element: withSuspense(
              <ErrorBoundary>
                <RaceAnalysis />
              </ErrorBoundary>,
            ),
          },
          { path: 'sprint', element: withSuspense(<RaceSprint />) },
          { path: 'info', element: withSuspense(<RaceInfo />) },
        ],
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
        element: withSuspense(<DriverDetail />),
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
        path: '/settings',
        element: withSuspense(<Settings />),
      },
      {
        path: '/login',
        element: withSuspense(<Login />),
      },
    ],
  },
]);

export default router;
