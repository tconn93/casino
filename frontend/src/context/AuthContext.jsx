import React, { createContext, useState, useContext, useEffect } from 'react';
import api from '../services/api';
import socket from '../services/socket';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.setToken(token);
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const userData = await api.getProfile();
      setUser(userData);
      socket.connect(localStorage.getItem('token'));
    } catch (error) {
      console.error('Failed to load user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (username, password) => {
    const userData = await api.login(username, password);
    setUser(userData);
    socket.connect(localStorage.getItem('token'));
  };

  const register = async (username, password, email) => {
    const userData = await api.register(username, password, email);
    setUser(userData);
    socket.connect(localStorage.getItem('token'));
  };

  const logout = () => {
    api.clearToken();
    socket.disconnect();
    setUser(null);
  };

  const updateBalance = (newBalance) => {
    setUser(prev => ({ ...prev, balance: newBalance }));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateBalance, loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
