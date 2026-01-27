import { useMemo } from 'react';
import { UTMCoordinate, Dimensiones } from '@/types/planos';
import { calculateArea, calculatePerimeter, calculateDistance } from '@/lib/geometry/utmUtils';

/**
 * Hook optimizado para cálculos geométricos
 * Usa useMemo para evitar recálculos innecesarios y re-renders en cascada
 * 
 * @param vertices - Array de coordenadas UTM del polígono
 * @returns Dimensiones calculadas (área, perímetro, lados)
 */
export function useGeometry(vertices: UTMCoordinate[]): Dimensiones {
  return useMemo(() => {
    // Validación: Se requieren al menos 3 vértices para un polígono válido
    if (vertices.length < 3) {
      return { 
        area: 0, 
        perimetro: 0, 
        frente: 0, 
        fondo: 0, 
        ladoDerecho: 0, 
        ladoIzquierdo: 0 
      };
    }

    // Cálculos geométricos
    const area = calculateArea(vertices);
    const perimetro = calculatePerimeter(vertices);
    
    // Cálculo de lados individuales
    // Asumiendo orden estándar: Frente (0-1), Derecha (1-2), Fondo (2-3), Izquierda (3-0)
    const frente = calculateDistance(vertices[0], vertices[1]);
    const ladoDerecho = vertices.length > 1 
      ? calculateDistance(vertices[1], vertices[2] || vertices[1]) 
      : 0;
    const fondo = vertices.length > 2 
      ? calculateDistance(vertices[2], vertices[3] || vertices[2]) 
      : 0;
    const ladoIzquierdo = vertices.length > 3 
      ? calculateDistance(vertices[3], vertices[0]) 
      : 0;

    return {
      area,
      perimetro,
      frente,
      ladoDerecho,
      fondo,
      ladoIzquierdo,
    };
  }, [vertices]); // Solo recalcula si los vértices cambian (comparación por referencia)
}

/**
 * Hook para validar si un polígono es válido
 * 
 * @param vertices - Array de coordenadas UTM
 * @returns boolean indicando si el polígono es válido
 */
export function usePolygonValidation(vertices: UTMCoordinate[]): {
  isValid: boolean;
  error?: string;
} {
  return useMemo(() => {
    if (vertices.length < 3) {
      return {
        isValid: false,
        error: 'Se requieren al menos 3 vértices'
      };
    }

    // Validar que no haya vértices duplicados consecutivos
    for (let i = 0; i < vertices.length; i++) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      
      if (current[0] === next[0] && current[1] === next[1]) {
        return {
          isValid: false,
          error: `Vértices duplicados en posición ${i}`
        };
      }
    }

    // Validar que el área no sea cero (polígono no colineal)
    const area = calculateArea(vertices);
    if (Math.abs(area) < 0.01) {
      return {
        isValid: false,
        error: 'Los vértices son colineales (área = 0)'
      };
    }

    return { isValid: true };
  }, [vertices]);
}
