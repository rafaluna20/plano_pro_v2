import { defineConfig } from 'vitest/config';
import path from 'path';

// Config mínima: solo pruebas unitarias de lógica pura (geometría), sin
// necesidad de un entorno DOM — mismo alias "@/*" que usa Next.js. Mismo
// criterio que mapa_renasur/vitest.config.ts.
export default defineConfig({
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
    test: {
        environment: 'node',
        include: ['**/*.test.ts'],
        exclude: ['node_modules', '.next'],
    },
});
