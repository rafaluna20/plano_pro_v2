'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- el cuerpo de la respuesta es JSON de forma variable */

/**
 * Llamadas del editor a /api/v1/proyectos y /api/v1/plantilla-datos.
 * Todas usan la sesión JWT (authFetch) y, ante un 401, NO redirigen al login: el editor
 * tiene trabajo sin guardar y redirigir lo perdería (el aviso lo muestra la pantalla).
 */
import { authFetch } from '@/lib/auth/authFetch';
import type { PlantillaDatos, ProyectoGuardado, ResumenProyecto } from './proyectos';

export class ErrorProyectos extends Error {
  constructor(message: string, public readonly code: string, public readonly status: number) {
    super(message);
  }
}

export interface ProyectoEnLista {
  id: string;
  nombre: string;
  resumen: ResumenProyecto | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProyectoCompleto {
  id: string;
  nombre: string;
  datos: unknown;
  updatedAt: string;
}

const MSG_SESION = 'Tu sesión venció. Abre /auth/login en otra pestaña, inicia sesión y vuelve a intentar: lo que escribiste aquí no se pierde.';

async function llamar<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await authFetch(url, init, { redirectOnUnauthorized: false });
  } catch {
    throw new ErrorProyectos('No se pudo conectar con el servidor. Revisa tu conexión.', 'RED', 0);
  }
  let cuerpo: any = null;
  try {
    cuerpo = await res.json();
  } catch {
    // respuesta sin JSON: se trata abajo según el estado HTTP
  }
  if (res.status === 401) throw new ErrorProyectos(MSG_SESION, 'SESION', 401);
  if (!res.ok || !cuerpo?.success) {
    throw new ErrorProyectos(
      cuerpo?.error?.message ?? `El servidor respondió con un error (${res.status}).`,
      cuerpo?.error?.code ?? 'ERROR',
      res.status,
    );
  }
  return cuerpo.data as T;
}

const JSON_HEADERS = { 'Content-Type': 'application/json' };

export const listarProyectos = () =>
  llamar<{ proyectos: ProyectoEnLista[] }>('/api/v1/proyectos').then((d) => d.proyectos);

export const abrirProyecto = (id: string) => llamar<ProyectoCompleto>(`/api/v1/proyectos/${encodeURIComponent(id)}`);

export const crearProyecto = (nombre: string, datos: ProyectoGuardado<object>) =>
  llamar<{ id: string; nombre: string; updatedAt: string }>('/api/v1/proyectos', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ nombre, datos }),
  });

export const actualizarProyecto = (id: string, nombre: string, datos: ProyectoGuardado<object>) =>
  llamar<{ id: string; nombre: string; updatedAt: string }>(`/api/v1/proyectos/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ nombre, datos }),
  });

export const eliminarProyecto = (id: string) =>
  llamar<{ id: string }>(`/api/v1/proyectos/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const duplicarProyecto = (id: string) =>
  llamar<{ id: string; nombre: string }>(`/api/v1/proyectos/${encodeURIComponent(id)}/duplicar`, { method: 'POST' });

export const leerPlantilla = () =>
  llamar<{ datos: PlantillaDatos | null }>('/api/v1/plantilla-datos').then((d) => d.datos);

export const guardarPlantilla = (datos: PlantillaDatos) =>
  llamar<{ datos: PlantillaDatos }>('/api/v1/plantilla-datos', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify({ datos }),
  }).then((d) => d.datos);
