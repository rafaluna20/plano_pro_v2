import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* * CONFIGURACIÓN CRÍTICA PARA GENERACIÓN DE PDFS 
   * Evita errores "Module not found: Can't resolve 'canvas'" o problemas con binarios nativos.
   */
  serverExternalPackages: ['canvas', 'jspdf'],

  /*
   * CONFIGURACIÓN PARA CARGAS ÚTILES GRANDES
   * Necesario si usas Server Actions para enviar la captura de pantalla (Base64).
   * Por defecto Next.js limita a 1MB. Aquí subimos a 10MB.
   */
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // Opcional: Si usas imágenes externas en tus componentes <Image />
  // images: {
  //   remotePatterns: [
  //     {
  //       protocol: 'https',
  //       hostname: 'maps.googleapis.com',
  //     },
  //   ],
  // },
};

export default nextConfig;