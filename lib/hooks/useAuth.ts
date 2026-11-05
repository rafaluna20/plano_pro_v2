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

/**
 * Un JWT vencido sigue en localStorage y el editor lo seguía mandando: el
 * servidor respondía 401 y el usuario solo veía "Error al conectar con el
 * servidor". Se lee `exp` del payload (solo para decidir si vale la pena
 * seguir; la verificación real de la firma la hace el servidor).
 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(
      atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    return typeof payload.exp === 'number' && Date.now() >= payload.exp * 1000;
  } catch {
    // Token ilegible: se trata como inválido.
    return true;
  }
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

        if (token && isTokenExpired(token)) {
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
        } else if (token && userStr) {
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
