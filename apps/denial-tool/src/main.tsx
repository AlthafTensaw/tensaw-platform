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

void bootstrap();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Root element #root not found');

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
