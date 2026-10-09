import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { HomePage } from './pages/HomePage';

const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  {
    path: '*',
    element: (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">404 · Page not found</p>
      </main>
    ),
  },
]);

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
