'use client';

/**
 * fetch con la sesión JWT del usuario, con manejo central del 401.
 *
 * Antes cada pantalla armaba su propio `Authorization: Bearer ...` y, si el
 * servidor respondía 401 (token vencido o firmado con otro secreto), el usuario
 * solo veía "Error al conectar con el servidor" sin saber que bastaba con volver
 * a iniciar sesión. Ahora cualquier 401 limpia la sesión y lleva al login con un
 * aviso claro.
 */

const SESSION_KEYS = ['token', 'apiKey', 'user'] as const;

export function clearSession(): void {
  try {
    SESSION_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage no disponible: nada que limpiar.
  }
}

/** Lleva al login indicando por qué (el login muestra el aviso). */
export function redirectToLogin(reason: 'expired' = 'expired'): void {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/auth/login')) return;
  window.location.assign(`/auth/login?${reason}=1`);
}

export interface AuthFetchOptions {
  /**
   * Si es false, ante un 401 solo se limpia la sesión y se devuelve la respuesta
   * (la pantalla decide qué avisar). Úsalo en pantallas con trabajo sin guardar,
   * como el editor: redirigir al login perdería lo que el usuario ya escribió.
   * Por defecto true.
   */
  redirectOnUnauthorized?: boolean;
}

export async function authFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  { redirectOnUnauthorized = true }: AuthFetchOptions = {}
): Promise<Response> {
  let token: string | null = null;
  try {
    token = localStorage.getItem('token');
  } catch {
    token = null;
  }

  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401) {
    clearSession();
    if (redirectOnUnauthorized) redirectToLogin('expired');
  }

  return response;
}
