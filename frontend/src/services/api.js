import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';
const API_BASE_URL = `${BACKEND_URL}/api`;

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (credentials) => {
    const response = await api.post('/auth/login', credentials);
    return response.data;
  },

  logout: async () => {
    const response = await api.post('/auth/logout');
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  }
};

// Users API
export const usersAPI = {
  getUsers: async (params = {}) => {
    const response = await api.get('/users', { params });
    return response.data;
  },

  createUser: async (userData) => {
    const response = await api.post('/users', userData);
    return response.data;
  },

  updateUser: async (userId, userData) => {
    const response = await api.put(`/users/${userId}`, userData);
    return response.data;
  },

  deleteUser: async (userId) => {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  }
};

// Products API
export const productsAPI = {
  getProducts: async (params = {}) => {
    const response = await api.get('/products', { params });
    return response.data;
  },

  // Generate a unique barcode from the backend
  generateBarcode: async () => {
    const response = await api.get('/products/generate-barcode');
    return response.data?.barcode || null;
  },

  createProduct: async (productData) => {
    const response = await api.post('/products', productData);
    return response.data;
  },

  getProduct: async (productId) => {
    const response = await api.get(`/products/${productId}`);
    return response.data;
  },

  getProductByBarcode: async (barcode) => {
    try {
      const response = await api.get(`/products/barcode/${barcode}`);
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  updateProduct: async (productId, productData) => {
    const response = await api.put(`/products/${productId}`, productData);
    return response.data;
  },

  deleteProduct: async (productId) => {
    const response = await api.delete(`/products/${productId}`);
    return response.data;
  }
};

// Stock API
export const stockAPI = {
  getMovements: async (params = {}) => {
    const response = await api.get('/stock/movements', { params });
    return response.data;
  },

  createMovement: async (movementData) => {
    const response = await api.post('/stock/movement', movementData);
    return response.data;
  },

  getLowStockProducts: async () => {
    const response = await api.get('/stock/low');
    return response.data;
  }
};

// Sales API
export const salesAPI = {
  getSales: async (params = {}) => {
    const response = await api.get('/sales', { params });
    return response.data;
  },

  createSale: async (saleData) => {
    const response = await api.post('/sales', saleData);
    return response.data;
  },

  getSale: async (saleId) => {
    const response = await api.get(`/sales/${saleId}`);
    return response.data;
  },

  getDailyReport: async (date) => {
    const response = await api.get('/sales/reports/daily', {
      params: date ? { date: date.toISOString() } : {}
    });
    return response.data;
  },

  // Download İrsaliye PDF for a given date range
  downloadIrsaliyePDF: async ({ start_date, end_date }) => {
    const response = await api.get('/sales/reports/irsaliye', {
      params: { start_date, end_date },
      responseType: 'blob'
    });
    return response.data; // Blob
  }
};

// Dashboard API
export const dashboardAPI = {
  getStats: async () => {
    const response = await api.get('/dashboard/stats');
    return response.data;
  },

  getTopProducts: async (limit = 5) => {
    const response = await api.get('/dashboard/top-products', {
      params: { limit }
    });
    return response.data;
  },

  getCashierPerformance: async () => {
    const response = await api.get('/dashboard/cashier-performance');
    return response.data;
  }
};

export default api;

// Finance API (Gelir-Gider)
// Tries backend first; if unavailable, falls back to localStorage so UI remains usable.
const LS_KEY = 'finance_transactions_v1';
const loadFromLS = () => {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const saveToLS = (items) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { }
};
const genId = () => `${Date.now()}_${Math.floor(Math.random() * 100000)}`;

export const financeAPI = {
  isBackendAvailable: async () => {
    try {
      // Probe transactions endpoint; if reachable and returns array/object, consider available
      const response = await api.get('/finance/transactions', { params: { _probe: 1 } });
      return response.status >= 200 && response.status < 300;
    } catch {
      return false;
    }
  },

  getTransactions: async (params = {}) => {
    try {
      const response = await api.get('/finance/transactions', { params });
      return response.data;
    } catch (err) {
      // Fallback to LS
      const all = loadFromLS();
      const { start_date, end_date, type, search } = params || {};
      const start = start_date ? new Date(start_date).getTime() : null;
      const end = end_date ? new Date(end_date).getTime() : null;
      return all.filter(t => {
        const ts = t.date ? new Date(t.date).getTime() : 0;
        if (start && ts < start) return false;
        if (end && ts > end) return false;
        if (type && type !== 'all' && t.type !== type) return false;
        if (search) {
          const s = search.toLowerCase();
          const hay = `${t.category || ''} ${t.description || ''} ${t.person || ''} ${t.created_by_name || ''}`.toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      });
    }
  },

  createTransaction: async (data) => {
    try {
      const response = await api.post('/finance/transactions', data);
      return response.data;
    } catch (err) {
      // Fallback
      const all = loadFromLS();
      const item = { id: genId(), ...data };
      all.unshift(item);
      saveToLS(all);
      return item;
    }
  },

  updateTransaction: async (id, data) => {
    try {
      const response = await api.put(`/finance/transactions/${id}`, data);
      return response.data;
    } catch (err) {
      const all = loadFromLS();
      const idx = all.findIndex(i => i.id === id);
      if (idx >= 0) {
        all[idx] = { ...all[idx], ...data };
        saveToLS(all);
        return all[idx];
      }
      throw err;
    }
  },

  deleteTransaction: async (id) => {
    try {
      const response = await api.delete(`/finance/transactions/${id}`);
      return response.data;
    } catch (err) {
      const all = loadFromLS().filter(i => i.id !== id);
      saveToLS(all);
      return { ok: true };
    }
  },

  getSummary: async (params = {}) => {
    try {
      const response = await api.get('/finance/summary', { params });
      return response.data;
    } catch (err) {
      // Fallback compute using LS directly
      const all = loadFromLS();
      const { start_date, end_date, type } = params || {};
      const start = start_date ? new Date(start_date).getTime() : null;
      const end = end_date ? new Date(end_date).getTime() : null;
      const list = all.filter(t => {
        const ts = t.date ? new Date(t.date).getTime() : 0;
        if (start && ts < start) return false;
        if (end && ts > end) return false;
        if (type && type !== 'all' && t.type !== type) return false;
        return true;
      });
      const income = list.filter(i => i.type === 'income').reduce((s, i) => s + (i.amount || 0), 0);
      const expense = list.filter(i => i.type === 'expense').reduce((s, i) => s + (i.amount || 0), 0);
      return { income, expense, net: income - expense };
    }
  }
};

// Expose local storage for finance to support migration UX
export const financeLocalStore = {
  list: () => loadFromLS(),
  clear: () => saveToLS([]),
  saveAll: (items) => saveToLS(items)
};

// Strict backend-only Finance API (no fallbacks). Use this when data must be shared across users.
export const financeAPIBackend = {
  getTransactions: async (params = {}) => {
    const response = await api.get('/finance/transactions', { params });
    return response.data;
  },
  createTransaction: async (data) => {
    const response = await api.post('/finance/transactions', data);
    return response.data;
  },
  updateTransaction: async (id, data) => {
    const response = await api.put(`/finance/transactions/${id}`, data);
    return response.data;
  },
  deleteTransaction: async (id) => {
    const response = await api.delete(`/finance/transactions/${id}`);
    return response.data;
  },
  getSummary: async (params = {}) => {
    const response = await api.get('/finance/summary', { params });
    return response.data;
  }
};