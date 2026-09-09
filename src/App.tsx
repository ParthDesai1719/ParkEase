import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { router } from './routes';
import { useAuthStore } from './stores/authStore';

export function App() {
  const checkAuth = useAuthStore((state) => state.checkAuth);

  useEffect(() => {
    // Check for an active session on initial application load
    void checkAuth();
  }, [checkAuth]);

  return <RouterProvider router={router} />;
}

export default App;
