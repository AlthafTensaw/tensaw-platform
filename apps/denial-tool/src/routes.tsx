/**
 * Top-level routes for the denial-tool app — v3.0.
 *
 * Layout:
 *   /sign-in                (public)
 *   /                       → redirect to /inbox
 *   /inbox                  (auth + denial.read)   ← v3.0 3-pane shell (was /worklist)
 *   /worklist               (alias of /inbox for backwards compat)
 *   /tasks                  (auth + denial.read)   ← TasksMinePage (still v2.x shape)
 *   /cost                   (auth + denial.view_cost)
 *
 * Note: /worklist kept as alias since muscle memory + saved bookmarks point
 * to it. v3.1 may sunset the alias.
 */

import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './AppLayout';
import { RequireAuth, RequirePermission } from './auth/RequireAuth';
import { SignInPage } from './pages/sign-in/SignInPage';
import { DenialInboxPage } from './pages/inbox/DenialInboxPage';
import { CostRoute } from './pages/cost/CostRoute';
import { TasksMinePage } from './pages/tasks/TasksMinePage';

import { RealSignInPage } from './pages/sign-in/RealSignInPage';

export function AppRoutes(): JSX.Element {
  const isRealAuth = import.meta.env.VITE_API_MODE === 'real';

  return (
    <Routes>
      <Route path="/sign-in" element={isRealAuth ? <RealSignInPage /> : <SignInPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/inbox" replace />} />
          <Route
            element={<RequirePermission permission="denial.read" />}
          >
            <Route path="/inbox" element={<DenialInboxPage />} />
            <Route path="/worklist" element={<Navigate to="/inbox" replace />} />
            <Route path="/tasks" element={<TasksMinePage />} />
          </Route>
          <Route
            element={<RequirePermission permission="denial.view_cost" />}
          >
            <Route path="/cost" element={<CostRoute />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/inbox" replace />} />
    </Routes>
  );
}
