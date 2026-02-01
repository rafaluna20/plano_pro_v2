'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import L from 'leaflet';
import { utmToLatLng } from '@/lib/geometry/utmUtils';

// Componente para ajustar la vista automáticamente
function MapBoundsSetter({ bounds }: { bounds: L.LatLngBounds | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20], animate: true });
    }
  }, [bounds, map]);
  return null;
}

interface LocationMapProps {
  vertices: Array<{ x: number, y: number }>;
  adyacentes: Array<{ vertices: Array<{ x: number, y: number }>, lote: string }>;
  interactive?: boolean;
}

function LocationMapInner({ vertices, adyacentes, interactive = false }: LocationMapProps) {
  const [mounted, setMounted] = useState(false);
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    import('leaflet').then(module => {
      setL(module.default);
    });
  }, []);

  const convertToLeaflet = (coords: { x: number, y: number }[]) => {
    return coords.map(v => {
      const [lng, lat] = utmToLatLng([v.x, v.y]);
      return [lat, lng] as [number, number];
    });
  };

  const mainLatLngs = useMemo(() => convertToLeaflet(vertices), [vertices]);

  const adyacentesData = useMemo(() => 
    adyacentes.map((ady: { vertices: Array<{ x: number, y: number }>, lote: string }) => ({
      latLngs: convertToLeaflet(ady.vertices),
      lote: ady.lote
    })),
    [adyacentes]
  );

  const bounds = useMemo(() => {
    if (!L || mainLatLngs.length === 0) return null;
    const all = [...mainLatLngs];
    adyacentesData.forEach((ady: { latLngs: [number, number][], lote: string }) => all.push(...ady.latLngs));
    return L.latLngBounds(all);
  }, [L, mainLatLngs, adyacentesData]);

  if (!mounted || !L || mainLatLngs.length < 3) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50 border border-slate-200 rounded">
        <span className="text-slate-400 text-xs animate-pulse">Cargando Mapa de Ubicación...</span>
      </div>
    );
  }

  // Importamos el componente de ajuste de vista sólo cuando está montado
  const MapBoundsSetter = () => {
    const map = useMap();
    useEffect(() => {
      if (bounds) {
        map.fitBounds(bounds, { padding: [20, 20], animate: true });
      }
    }, [bounds, map]);
    return null;
  };

  return (
    <div className="w-full h-full relative">
      <MapContainer 
        center={mainLatLngs[0]} 
        zoom={20} 
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
        className="w-full h-full z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={24}
        />

        {/* Lotes Adyacentes */}
        {adyacentesData.map((ady, idx) => (
          <Polygon 
            key={idx}
            positions={ady.latLngs}
            pathOptions={{ 
              color: '#94a3b8', 
              weight: 1, 
              dashArray: '5, 5',
              fillColor: '#f1f5f9',
              fillOpacity: 0.4
            }}
          />
        ))}

        {/* Lote Principal */}
        <Polygon 
          positions={mainLatLngs}
          pathOptions={{ 
            color: '#000000', 
            weight: 2, 
            fillColor: '#1e293b', 
            fillOpacity: 0.5 
          }}
        />

        <MapBoundsSetter />
      </MapContainer>
    </div>
  );
}

export default LocationMapInner;
