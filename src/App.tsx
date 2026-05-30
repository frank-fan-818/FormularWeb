import { RouterProvider } from 'react-router-dom';
import router from '@/router';
import { ThemeProvider } from '@/components/ThemeProvider';
import { HelmetProvider } from 'react-helmet-async';

function App() {
  return (
    <HelmetProvider>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
