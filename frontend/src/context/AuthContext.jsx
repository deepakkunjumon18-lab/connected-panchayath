import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '../api/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('cp_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('cp_token'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Load and verify me on mount
  useEffect(() => {
    async function initAuth() {
      if (token) {
        try {
          const res = await authApi.getMe();
          const userData = res?.data || (res?.user_id ? res : null);
          if (userData && userData.user_id) {
            setUser(userData);
            localStorage.setItem('cp_user', JSON.stringify(userData));
          }
        } catch (err) {
          console.error('Failed to restore session:', err);
          logout(false);
        }
      }
      setLoading(false);
    }
    initAuth();
  }, []);

  const getHomeRoute = (role) => {
    switch (role) {
      case 'CITIZEN': return '/citizen';
      case 'OFFICER': return '/officer';
      case 'ADMIN': return '/admin';
      default: return '/login';
    }
  };

  const login = async (identifier, password, login_as) => {
    try {
      const res = await authApi.login({ identifier, password, login_as });
      if (res.success && res.data) {
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('cp_token', newToken);
        localStorage.setItem('cp_user', JSON.stringify(newUser));
        toast.success(`Welcome, ${newUser.full_name || newUser.username}!`);
        navigate(getHomeRoute(newUser.role));
        return { success: true };
      }
      return { success: false, message: res.message || 'Login failed' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      toast.error(msg);
      return { success: false, message: msg };
    }
  };

  const register = async (formData) => {
    try {
      const res = await authApi.register(formData);
      if (res.success && res.data) {
        const { token: newToken, user: newUser } = res.data;
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('cp_token', newToken);
        localStorage.setItem('cp_user', JSON.stringify(newUser));
        toast.success('Registration successful! Welcome to Connected Panchayat.');
        navigate('/citizen');
        return { success: true };
      }
      return { success: false, message: res.message || 'Registration failed' };
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Registration failed';
      const errors = err.response?.data?.errors;
      toast.error(msg);
      return { success: false, message: msg, errors };
    }
  };

  const logout = (notify = true) => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('cp_token');
    localStorage.removeItem('cp_user');
    if (notify) toast.success('Logged out successfully');
    navigate('/login');
  };

  const refreshUser = async () => {
    try {
      const res = await authApi.getMe();
      const userData = res?.data || (res?.user_id ? res : null);
      if (userData && userData.user_id) {
        setUser(userData);
        localStorage.setItem('cp_user', JSON.stringify(userData));
        return userData;
      }
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        login,
        register,
        logout,
        refreshUser,
        getHomeRoute,
        isAuthenticated: !!token && !!user
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
