import { describe, it, expect } from 'vitest';
import { muestrearArco, expandirVerticesConArcos } from './arcoUtils';
import type { ArcoMetadata } from '@/types/planos';

// MISMO vector de prueba que mapa_renasur/app/utils/arcoUtils.test.ts
// (dato real de producción: Mz Q Lote 39, radio=6, longitudArco=10.74,
// sentido=horario) — a propósito: la matemática de arco está triplicada
// (acá, en mapa_renasur, y en el widget JS de elemento_urbano_geometry en
// Odoo) sin paquete compartido. Usar el mismo vector real en ambas copias
// con test es la única forma barata de detectar si una diverge de la otra
// sin unificarlas en un paquete — si cambiás la fórmula acá, corré también
// el test equivalente del otro repo (y revisá a mano el widget de Odoo,
// que no tiene test automatizado).
const p1: [number, number] = [308626.1493, 8622896.2968];
const p2: [number, number] = [308620.6952, 8622903.905];
const arcoReal: ArcoMetadata = { indiceVertice: 0, radio: 6, longitudArco: 10.74, sentido: 'horario' };

function distancia(a: [number, number], b: [number, number]): number {
    return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2);
}

describe('muestrearArco', () => {
    it('el primer y ultimo punto muestreado coinciden exactamente con p1/p2', () => {
        const puntos = muestrearArco(p1, p2, arcoReal, 16);
        expect(puntos[0][0]).toBeCloseTo(p1[0], 6);
        expect(puntos[0][1]).toBeCloseTo(p1[1], 6);
        expect(puntos[puntos.length - 1][0]).toBeCloseTo(p2[0], 6);
        expect(puntos[puntos.length - 1][1]).toBeCloseTo(p2[1], 6);
    });

    it('todos los puntos muestreados quedan a "radio" metros de un centro comun (estan en el circulo)', () => {
        const puntos = muestrearArco(p1, p2, arcoReal, 16);
        const [ax, ay] = puntos[0];
        const [bx, by] = puntos[Math.floor(puntos.length / 2)];
        const [cx, cy] = puntos[puntos.length - 1];
        const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
        const centroX = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
        const centroY = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;

        for (const p of puntos) {
            expect(distancia(p, [centroX, centroY])).toBeCloseTo(arcoReal.radio, 2);
        }
    });

    it('la suma de las distancias entre puntos consecutivos aproxima la longitud real del arco', () => {
        const puntos = muestrearArco(p1, p2, arcoReal, 64);
        let longitud = 0;
        for (let i = 1; i < puntos.length; i++) {
            longitud += distancia(puntos[i - 1], puntos[i]);
        }
        expect(longitud).toBeCloseTo(arcoReal.longitudArco, 1);
    });

    it('lanza un error si el radio es menor a la mitad de la distancia entre los 2 puntos', () => {
        const radioInvalido = { radio: 1, longitudArco: 5, sentido: 'horario' as const };
        expect(() => muestrearArco(p1, p2, radioInvalido)).toThrow();
    });
});

describe('expandirVerticesConArcos', () => {
    // Cerrado (primer punto == último), a diferencia del cuadrado abierto
    // que usa mapa_renasur — plan_pro espera vértices ya cerrados (ver
    // comentario de la función).
    const cuadradoCerrado: [number, number][] = [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
        [0, 0],
    ];

    it('sin arcos, devuelve los vertices sin modificar', () => {
        expect(expandirVerticesConArcos(cuadradoCerrado, undefined)).toEqual(cuadradoCerrado);
        expect(expandirVerticesConArcos(cuadradoCerrado, [])).toEqual(cuadradoCerrado);
    });

    it('con un arco, inserta puntos intermedios entre esos 2 vertices', () => {
        const arco: ArcoMetadata = { indiceVertice: 0, radio: 10, longitudArco: 12, sentido: 'antihorario' };
        const expandido = expandirVerticesConArcos(cuadradoCerrado, [arco]);
        expect(expandido.length).toBeGreaterThan(cuadradoCerrado.length);
        expect(expandido[0]).toEqual(cuadradoCerrado[0]);
    });

    it('los lados sin arco se mantienen como lineas rectas (sin puntos extra)', () => {
        const arco: ArcoMetadata = { indiceVertice: 2, radio: 10, longitudArco: 12, sentido: 'horario' };
        const expandido = expandirVerticesConArcos(cuadradoCerrado, [arco]);
        expect(expandido).toContainEqual(cuadradoCerrado[1]);
    });
});
