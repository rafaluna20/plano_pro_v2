'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { UTMCoordinate } from '@/types/planos';

interface MapCanvasProps {
  vertices: UTMCoordinate[];
  onVerticesChange?: (vertices: UTMCoordinate[]) => void;
  editable?: boolean;
  showContext?: boolean;
  contextLotes?: Array<{
    codigo: string;
    vertices: UTMCoordinate[];
    estado: string;
  }>;
}

function MapCanvasInner({
  vertices,
  onVerticesChange,
  editable = false,
  showContext = false,
  contextLotes = []
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || typeof window === 'undefined') return;

    // Importar Leaflet dinámicamente
    import('leaflet').then((L) => {
      // Limpiar mapa existente
      const container = containerRef.current;
      if (!container) return;
      
      container.innerHTML = '';

      // Crear mapa
      const map = L.map(container, {
        center: [-12.0464, -77.0428], // Lima, Perú
        zoom: 13,
        zoomControl: true,
      });

      // Agregar tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Si hay vértices, dibujar el polígono
      if (vertices.length >= 3) {
        // Convertir UTM a LatLng (simplificado - asumiendo que son ya lat/lng para el ejemplo)
        const latLngs = vertices.map(([x, y]) => [y / 1000000, x / 1000000] as [number, number]);

        // Crear polígono
        const polygon = L.polygon(latLngs, {
          color: '#2196F3',
          fillColor: '#4CAF50',
          fillOpacity: 0.3,
          weight: 2,
        }).addTo(map);

        // Centrar mapa en el polígono
        map.fitBounds(polygon.getBounds(), { padding: [50, 50] });

        // Agregar markers si es editable
        if (editable) {
          latLngs.forEach((latLng, index) => {
            const marker = L.marker(latLng, {
              draggable: true,
              icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                  width: 16px;
                  height: 16px;
                  background: #FF5722;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                  cursor: move;
                "></div>`,
                iconSize: [16, 16],
                iconAnchor: [8, 8],
              }),
            }).addTo(map);

            marker.on('dragend', () => {
              // Aquí iría la lógica para actualizar vertices
              console.log('Marker moved:', index);
            });
          });
        }
      }

      return () => {
        map.remove();
      };
    }).catch((err) => {
      console.error('Error loading Leaflet:', err);
    });
  }, [mounted, vertices, editable]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
      
      {editable && mounted && (
        <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3 text-sm z-[1000]">
          <p className="font-semibold mb-1">Modo Edición</p>
          <p className="text-gray-600">Arrastra los puntos rojos para editar</p>
        </div>
      )}
      
      {(!mounted || vertices.length < 3) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <p className="text-gray-600">
            {!mounted ? 'Cargando mapa...' : 'Esperando coordenadas del lote...'}
          </p>
        </div>
      )}
    </div>
  );
}

// Exportar con dynamic para evitar SSR
export const MapCanvas = dynamic(() => Promise.resolve(MapCanvasInner), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Cargando mapa...</p>
    </div>
  ),
});
