import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@tensaw/runtime';
import { ToastHost } from '@tensaw/wired-components';
import '@tensaw/design-system/styles/global.css';
import './denial-tool.css';

import { AppThemeProvider } from './AppTheme';
import { AppRoutes } from './routes';
import { bootstrap } from './bootstrap';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, signOut as amplifySignOut } from 'aws-amplify/auth';
import { setTokenProvider } from '@tensaw/runtime';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID,
      userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID,
    },
  },
});

setTokenProvider({
  getIdToken: async (opts) => {
    try {
      const session = await fetchAuthSession({ forceRefresh: opts?.forceRefresh });
      return session.tokens?.idToken?.toString() ?? null;
    } catch { return null; }
  },
  getAccessToken: async (opts) => {
    try {
      const session = await fetchAuthSession({ forceRefresh: opts?.forceRefresh });
      return session.tokens?.idToken?.toString() ?? null;
    } catch { return null; }
  },
  signOut: async () => {
    await amplifySignOut({ global: false });
  }
});

void bootstrap();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

console.log("started....")

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AppThemeProvider>
          <AppRoutes />
          <ToastHost />
        </AppThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>,
);
