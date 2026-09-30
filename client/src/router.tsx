import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from '@/auth/ProtectedRoute';
import { Layout } from '@/components/Layout';
import { DashboardPage } from '@/pages/DashboardPage';
import { LoginPage } from '@/pages/LoginPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { TicketDetailPage } from '@/pages/TicketDetailPage';
import { TicketListPage } from '@/pages/TicketListPage';
import { TicketNewPage } from '@/pages/TicketNewPage';

/**
 * Table de routage.
 *
 * `/tickets/nouveau` est déclaré avant la route paramétrée `/tickets/:id` :
 * sans cet ordre, React Router l'interpréterait comme un identifiant.
 */
export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <Layout />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/tickets', element: <TicketListPage /> },
          { path: '/tickets/nouveau', element: <TicketNewPage /> },
          { path: '/tickets/:id', element: <TicketDetailPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);