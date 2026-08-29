import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: any) => void }> = [];

const processQueue = (error: any, token: string | null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token!);
    }
  });
  failedQueue = [];
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pawtag_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config;

    if (err.response?.status === 401 && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('pawtag_refresh_token');

      if (!refreshToken) {
        localStorage.removeItem('pawtag_token');
        localStorage.removeItem('pawtag_refresh_token');
        // Don't hard-redirect during checkout — it destroys cart state.
        // Let the calling code handle the 401 gracefully.
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/checkout')) {
          window.location.href = '/login';
        }
        return Promise.reject(err);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((error) => Promise.reject(error));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const res = await axios.post('/api/auth/refresh', { refreshToken });
        const { token: newAccessToken, refreshToken: newRefreshToken } = res.data.data;

        localStorage.setItem('pawtag_token', newAccessToken);
        localStorage.setItem('pawtag_refresh_token', newRefreshToken);

        api.defaults.headers.common.Authorization = `Bearer ${newAccessToken}`;
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        processQueue(null, newAccessToken);

        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('pawtag_token');
        localStorage.removeItem('pawtag_refresh_token');
        // Don't hard-redirect during checkout — it destroys cart state.
        if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/checkout')) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

export default api;
