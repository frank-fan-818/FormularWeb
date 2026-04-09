import { createBrowserRouter } from 'react-router-dom';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Seasons from '@/pages/Seasons';
import Races from '@/pages/Races';
import RaceDetail from '@/pages/RaceDetail';
import Drivers from '@/pages/Drivers';
import DriverDetail from '@/pages/DriverDetail';
import Constructors from '@/pages/Constructors';
import ConstructorDetail from '@/pages/ConstructorDetail';
import Circuits from '@/pages/Circuits';
import CircuitDetail from '@/pages/CircuitDetail';

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
        element: <Seasons />,
      },
      {
        path: '/races',
        element: <Races />,
      },
      {
        path: '/races/:round',
        element: <RaceDetail />,
      },
      {
        path: '/drivers',
        element: <Drivers />,
      },
      {
        path: '/drivers/:driverId',
        element: <DriverDetail />,
      },
      {
        path: '/constructors',
        element: <Constructors />,
      },
      {
        path: '/constructors/:constructorId',
        element: <ConstructorDetail />,
      },
      {
        path: '/circuits',
        element: <Circuits />,
      },
      {
        path: '/circuits/:circuitId',
        element: <CircuitDetail />,
      },
    ],
  },
]);

export default router;
