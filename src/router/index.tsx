import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from '@/components/Layout';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { routeModules } from './routeModules';

const Home = lazy(routeModules.home);
const Seasons = lazy(routeModules.seasons);
const Races = lazy(routeModules.races);
const RaceLayout = lazy(routeModules.raceLayout);
const RaceResults = lazy(routeModules.raceResults);
const RaceQualifying = lazy(routeModules.raceQualifying);
const RaceAnalysis = lazy(routeModules.raceAnalysis);
const RaceSprint = lazy(routeModules.raceSprint);
const RaceInfo = lazy(routeModules.raceInfo);
const Drivers = lazy(routeModules.drivers);
const DriverDetail = lazy(routeModules.driverDetail);
const Constructors = lazy(routeModules.constructors);
const ConstructorDetail = lazy(routeModules.constructorDetail);
const ConstructorHistoryDetail = lazy(routeModules.constructorHistoryDetail);
const Circuits = lazy(routeModules.circuits);
const CircuitDetail = lazy(routeModules.circuitDetail);
const Settings = lazy(routeModules.settings);
const Login = lazy(routeModules.login);
const Privacy = lazy(routeModules.privacy);
const NotFound = lazy(routeModules.notFound);

function withSuspense(element: JSX.Element) {
  return (
    <Suspense
      fallback={(
        <div className="route-loading-surface" role="status" aria-label="loading">
          <div className="route-loading-indicator">Loading telemetry</div>
        </div>
      )}
    >
      {element}
    </Suspense>
  );
}

function RaceIndexRedirect() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: 'results', search }} replace />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<ErrorBoundary><Layout /></ErrorBoundary>}>
      <Route index element={withSuspense(<Home />)} />
      <Route path="seasons" element={withSuspense(<Seasons />)} />
      <Route path="races" element={withSuspense(<Races />)} />
      <Route path="races/:round" element={withSuspense(<RaceLayout />)}>
        <Route index element={<RaceIndexRedirect />} />
        <Route path="results" element={withSuspense(<RaceResults />)} />
        <Route path="qualifying" element={withSuspense(<RaceQualifying />)} />
        <Route
          path="race"
          element={withSuspense(
            <ErrorBoundary>
              <RaceAnalysis />
            </ErrorBoundary>,
          )}
        />
        <Route path="sprint" element={withSuspense(<RaceSprint />)} />
        <Route path="info" element={withSuspense(<RaceInfo />)} />
      </Route>
      <Route path="drivers" element={withSuspense(<Drivers />)} />
      <Route path="drivers/:driverId" element={withSuspense(<DriverDetail />)} />
      <Route path="history/drivers/:driverId" element={withSuspense(<DriverDetail />)} />
      <Route path="constructors" element={withSuspense(<Constructors />)} />
      <Route path="constructors/:constructorId" element={withSuspense(<ConstructorDetail />)} />
      <Route path="history/constructors/:constructorId" element={withSuspense(<ConstructorHistoryDetail />)} />
      <Route path="circuits" element={withSuspense(<Circuits />)} />
      <Route path="circuits/:circuitId" element={withSuspense(<CircuitDetail />)} />
      <Route path="settings" element={withSuspense(<Settings />)} />
      <Route path="login" element={withSuspense(<Login />)} />
      <Route path="privacy" element={withSuspense(<Privacy />)} />
      <Route path="*" element={withSuspense(<NotFound />)} />
    </Route>
  </Routes>
);

export default AppRoutes;
