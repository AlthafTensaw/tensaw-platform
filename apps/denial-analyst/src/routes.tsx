/**
 * Top-level routes for the denial-tool app.
 *
 * Layout:
 *   /sign-in                (public)
 *   /                       → redirect to /worklist
 *   /worklist               (auth + denial.read)
 *   /cost                   (auth + denial.view_cost — manager/admin only)
 *
 * Permission gating done by RequireAuth / RequirePermission outlets.
 */

import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequirePermission } from './auth/RequireAuth';
import { SignInPage } from './pages/sign-in/SignInPage';
import { WorklistRoute } from './pages/worklist/WorklistRoute';
import { CostRoute } from './pages/cost/CostRoute';

export const routeTable: RouteObject[] = [
  {
    path: '/sign-in',
    element: <SignInPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/worklist" replace /> },
          {
            element: <RequirePermission permission="denial.read" />,
            children: [
              { path: 'worklist', element: <WorklistRoute /> },
            ],
          },
          {
            element: <RequirePermission permission="denial.view_cost" />,
            children: [
              { path: 'cost', element: <CostRoute /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/worklist" replace />,
  },
];

const router = createBrowserRouter(routeTable);

export function AppRouter(): JSX.Element {
  return <RouterProvider router={router} />;
}

