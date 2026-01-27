'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  nombre: string;
  email: string;
  empresa?: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  apiKey: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export function useAuth() {
  const router = useRouter();
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    apiKey: null,
    isAuthenticated: false,
    isLoading: true
  });

  useEffect(() => {
    // Verificar autenticación del usuario
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const apiKey = localStorage.getItem('apiKey');
        const userStr = localStorage.getItem('user');

        if (token && userStr) {
          const user = JSON.parse(userStr);
          setAuthState({
            user,
            token,
            apiKey,
            isAuthenticated: true,
            isLoading: false
          });
        } else {
          setAuthState({
            user: null,
            token: null,
            apiKey: null,
            isAuthenticated: false,
            isLoading: false
          });
        }
      } catch (error) {
        console.error('Error al verificar autenticación:', error);
        setAuthState({
          user: null,
          token: null,
          apiKey: null,
          isAuthenticated: false,
          isLoading: false
        });
      }
    };

    checkAuth();
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('user');
    setAuthState({
      user: null,
      token: null,
      apiKey: null,
      isAuthenticated: false,
      isLoading: false
    });
    router.push('/auth/login');
  };

  const requireAuth = (redirectTo: string = '/auth/login') => {
    if (!authState.isLoading && !authState.isAuthenticated) {
      router.push(redirectTo);
    }
  };

  return {
    ...authState,
    logout,
    requireAuth
  };
}
