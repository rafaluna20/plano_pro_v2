import { z } from 'zod';
import { LIMITE_BYTES_PROYECTO } from '@/lib/editor/proyectos';

export const MAX_PROYECTOS_POR_USUARIO = 300;

const textoCorto = z.string().trim().max(200);

export const proyectoBodySchema = z.object({
  nombre: z.string().trim().min(1, 'Escribe un nombre para el proyecto').max(120, 'El nombre admite hasta 120 caracteres'),
  datos: z.object({
    version: z.number().int().min(0).max(1000),
    data: z.record(z.string(), z.unknown()),
  }),
});

export const plantillaBodySchema = z.object({
  datos: z
    .object({
      tipoDocumento: textoCorto,
      proyecto: textoCorto,
      profesional: textoCorto,
      registro: textoCorto,
      departamento: textoCorto,
      provincia: textoCorto,
      distrito: textoCorto,
    })
    .partial()
    .strict(),
});

/** El JSON guardado no puede pasar del límite de cuerpo de Vercel. */
export function excedeLimite(valor: unknown): boolean {
  return Buffer.byteLength(JSON.stringify(valor), 'utf8') > LIMITE_BYTES_PROYECTO;
}
