import axios from 'axios';
import { useAuthStore } from '@/stores/auth.store';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // send httpOnly refresh token cookie
});

// Attach access token to every request
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh on 401
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve) => {
          refreshSubscribers.push((token: string) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
        const { accessToken } = res.data.data as { accessToken: string };
        useAuthStore.getState().setAccessToken(accessToken);
        refreshSubscribers.forEach((cb) => cb(accessToken));
        refreshSubscribers = [];
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        // Clear subscribers BEFORE logout — prevents queued requests from hanging
        // indefinitely if the logout action triggers additional 401 responses
        refreshSubscribers = [];
        useAuthStore.getState().logout();
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
