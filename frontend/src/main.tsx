import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './index.css';
import { flushSyncQueue, syncProducts } from './sync/sync-queue';
import { useAuthStore } from './stores/auth.store';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,     // 2 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── Online/offline sync handler ───────────────────────────────────────────────
window.addEventListener('online', async () => {
  const { user } = useAuthStore.getState();
  if (!user) return;
  await flushSyncQueue();
  await syncProducts(user.businessId);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster position="top-right" />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </React.StrictMode>
);
