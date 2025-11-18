const API_URL = '/api';

class ApiService {
  constructor() {
    this.token = localStorage.getItem('token');
  }

  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  async register(username, password, email) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, email }),
    });
    this.setToken(data.token);
    return data.user;
  }

  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.setToken(data.token);
    return data.user;
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  async getBalance() {
    return this.request('/wallet/balance');
  }

  async getTransactions(limit = 50) {
    return this.request(`/wallet/transactions?limit=${limit}`);
  }

  async addFunds(amount) {
    return this.request('/wallet/add-funds', {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }
}

export default new ApiService();
