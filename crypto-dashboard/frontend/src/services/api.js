import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
});

// Attach JWT token to every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Handle 401 — clear storage and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error?.config?.url || '';
    const isAuthFormRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register');

    if (error.response && error.response.status === 401 && !isAuthFormRequest) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const login = (data) => api.post('/auth/login', data);
export const register = (data) => api.post('/auth/register', data);
export const getSessionUser = () => api.get('/auth/me');
export const getWatchlist = () => api.get('/watchlist');
export const addToWatchlist = (coin) => api.post('/watchlist/add', { coin });
export const removeFromWatchlist = (coin) => api.delete('/watchlist/remove', { data: { coin } });
export const getAlerts = () => api.get('/alerts');
export const createAlert = (data) => api.post('/alerts', data);
export const deleteAlert = (id) => api.delete(`/alerts/${id}`);
export const getCurrentPrices = () => api.get('/prices/current');
export const getPriceHistory = async (coinId, days = 7) => {
  const response = await api.get(`/prices/history/${coinId}?days=${days}`);
  return response.data;
};
export const getCoinList = async () => {
  const response = await api.get('/coins');
  return response.data;
};

export default api;
