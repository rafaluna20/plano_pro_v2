'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { UTMCoordinate } from '@/types/planos';
import { Search, MapPin, Crosshair, Target } from 'lucide-react';
import toast from 'react-hot-toast';
import { useEditorStore } from '@/lib/editor/store';

interface MapViewProps {
  vertices: UTMCoordinate[];
  center?: [number, number]; // Lat, Lng
  onLocationSelect?: (coords: UTMCoordinate, address?: string) => void;
  onCenterChange?: (center: [number, number]) => void;
  onOriginSet?: (lat: number, lng: number) => void;
}

function MapViewInner({ vertices, center, onLocationSelect, onCenterChange, onOriginSet }: MapViewProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const originMarkerRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [selectingOrigin, setSelectingOrigin] = useState(false);
  const [currentCenter, setCurrentCenter] = useState<[number, number]>(
    center || [-12.0464, -77.0428] // Lima, Perú por defecto
  );
  
  const { coordinateSystem, setOrigin } = useEditorStore();

  // Geocoding: buscar dirección
  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      toast.error('Ingresa una dirección para buscar');
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `format=json&q=${encodeURIComponent(searchQuery)}&` +
        `countrycodes=pe&limit=1`
      );
      
      const data = await response.json();
      
      if (data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newCenter: [number, number] = [parseFloat(lat), parseFloat(lon)];
        
        setCurrentCenter(newCenter);
        
        if (mapRef.current) {
          mapRef.current.setView(newCenter, 18);
        }
        
        toast.success(`Ubicación encontrada: ${display_name}`);
        onCenterChange?.(newCenter);
      } else {
        toast.error('No se encontró la ubicación. Intenta con otra dirección.');
      }
    } catch (error) {
      console.error('Error en geocoding:', error);
      toast.error('Error al buscar la ubicación');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, onCenterChange]);

  // Obtener ubicación actual del usuario
  const handleGetMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast.error('Geolocalización no disponible en tu navegador');
      return;
    }

    toast.loading('Obteniendo tu ubicación...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newCenter: [number, number] = [
          position.coords.latitude,
          position.coords.longitude
        ];
        
        setCurrentCenter(newCenter);
        
        if (mapRef.current) {
          mapRef.current.setView(newCenter, 18);
        }
        
        toast.dismiss();
        toast.success('Ubicación obtenida');
        onCenterChange?.(newCenter);
      },
      (error) => {
        toast.dismiss();
        toast.error('No se pudo obtener tu ubicación');
        console.error('Geolocation error:', error);
      }
    );
  }, [onCenterChange]);

  // Inicializar mapa
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !containerRef.current || typeof window === 'undefined') return;

    let map: any = null;
    let mapInitialized = false;

    const initMap = async () => {
      try {
        const L = await import('leaflet');
        
        const container = containerRef.current;
        if (!container || mapInitialized) return;
        
        // Limpiar mapa anterior si existe
        if (mapRef.current) {
          try {
            mapRef.current.off();
            mapRef.current.remove();
          } catch (e) {
            // Ignorar errores de cleanup
          }
          mapRef.current = null;
        }
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        // Remover ID de Leaflet
        if ((container as any)._leaflet_id) {
          delete (container as any)._leaflet_id;
        }

        // Crear mapa
        map = L.map(container, {
          center: currentCenter,
          zoom: 16,
          zoomControl: true,
        });

        mapRef.current = map;
        mapInitialized = true;

        // Agregar tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19,
        }).addTo(map);

        // Click en el mapa para seleccionar ubicación u origen
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          
          // Si estamos seleccionando el origen
          if (selectingOrigin) {
            // Remover marcador anterior si existe
            if (originMarkerRef.current) {
              originMarkerRef.current.remove();
            }
            
            // Crear marcador de origen
            originMarkerRef.current = L.marker([lat, lng], {
              icon: L.divIcon({
                className: 'origin-marker',
                html: `<div style="
                  width: 32px;
                  height: 32px;
                  background: #10b981;
                  border: 4px solid white;
                  border-radius: 50%;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.4);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: white;
                  font-weight: bold;
                  font-size: 16px;
                ">⊕</div>`,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
              }),
            }).addTo(map);
            
            // Agregar círculo de referencia
            L.circle([lat, lng], {
              radius: 5,
              color: '#10b981',
              fillColor: '#10b981',
              fillOpacity: 0.1,
              weight: 2,
            }).addTo(map);
            
            // Establecer origen en el store
            setOrigin(lat, lng);
            onOriginSet?.(lat, lng);
            
            setSelectingOrigin(false);
            toast.success(`Origen establecido en (${lat.toFixed(6)}, ${lng.toFixed(6)})`);
            return;
          }
          
          // Modo normal: seleccionar ubicación
          if (onLocationSelect) {
            // Convertir Lat/Lng a UTM simplificado (por ahora multiplicamos por 1M)
            // TODO: Implementar conversión UTM real usando librería 'utm'
            const utmCoord: UTMCoordinate = [lng * 1000000, lat * 1000000];
            
            // Agregar marcador temporal
            const marker = L.marker([lat, lng], {
              icon: L.divIcon({
                className: 'custom-marker',
                html: `<div style="
                  width: 24px;
                  height: 24px;
                  background: #3b82f6;
                  border: 3px solid white;
                  border-radius: 50%;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                "></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              }),
            }).addTo(map);
            
            // Reverse geocoding para obtener dirección
            fetch(
              `https://nominatim.openstreetmap.org/reverse?` +
              `format=json&lat=${lat}&lon=${lng}`
            )
              .then(res => res.json())
              .then(data => {
                const address = data.display_name || 'Ubicación seleccionada';
                onLocationSelect(utmCoord, address);
                toast.success(`Ubicación seleccionada: ${address.substring(0, 50)}...`);
              })
              .catch(() => {
                onLocationSelect(utmCoord);
                toast.success('Ubicación seleccionada');
              });
          }
        });
        
        // Cambiar cursor cuando estamos seleccionando origen
        if (selectingOrigin && mapRef.current) {
          mapRef.current.getContainer().style.cursor = 'crosshair';
        } else if (mapRef.current) {
          mapRef.current.getContainer().style.cursor = '';
        }

        // Si hay vértices, dibujar el polígono
        if (vertices.length >= 3) {
          // Convertir UTM a LatLng (simplificado - dividir por 1M)
          const latLngs = vertices.map((v): [number, number] => [v[1] / 1000000, v[0] / 1000000]);

          // Crear polígono
          const polygon = L.polygon(latLngs, {
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
            weight: 3,
          }).addTo(map);

          // Centrar mapa en el polígono
          map.fitBounds(polygon.getBounds(), { padding: [50, 50] });

          // Agregar marcadores en los vértices
          latLngs.forEach((latLng, index) => {
            L.marker(latLng, {
              icon: L.divIcon({
                className: 'vertex-marker',
                html: `<div style="
                  width: 20px;
                  height: 20px;
                  background: #ef4444;
                  color: white;
                  border: 2px solid white;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 10px;
                  font-weight: bold;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                ">${index + 1}</div>`,
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              }),
            }).addTo(map);
          });
        }
      } catch (err) {
        console.error('Error loading Leaflet:', err);
        toast.error('Error al cargar el mapa');
      }
    };

    initMap();

    return () => {
      mapInitialized = false;
      if (map) {
        try {
          map.off();
          map.remove();
        } catch (e) {
          // Ignorar errores de cleanup
        }
      }
      if (originMarkerRef.current) {
        try {
          originMarkerRef.current.remove();
        } catch (e) {
          // Ignorar errores
        }
      }
    };
  }, [mounted, vertices, currentCenter, onLocationSelect, selectingOrigin, setOrigin, onOriginSet]);

  return (
    <div className="relative w-full h-full">
      {/* Barra de búsqueda y controles */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex gap-2">
        <div className="flex-1 flex gap-2 bg-white rounded-lg shadow-lg p-2">
          <div className="flex-1 flex items-center gap-2 px-3 bg-gray-50 rounded-md">
            <Search size={18} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar dirección en Perú..."
              className="flex-1 bg-transparent border-none outline-none text-sm"
            />
          </div>
          
          <button
            onClick={handleSearch}
            disabled={isSearching}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {isSearching ? 'Buscando...' : 'Buscar'}
          </button>
        </div>

        <button
          onClick={handleGetMyLocation}
          className="p-3 bg-white rounded-lg shadow-lg hover:bg-gray-50 transition-colors"
          title="Mi ubicación"
        >
          <Crosshair size={20} className="text-gray-700" />
        </button>
        
        <button
          onClick={() => setSelectingOrigin(!selectingOrigin)}
          className={`p-3 rounded-lg shadow-lg transition-colors ${
            selectingOrigin
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title={selectingOrigin ? 'Cancelar selección de origen' : 'Seleccionar punto de origen (0,0)'}
        >
          <Target size={20} />
        </button>
      </div>

      {/* Contenedor del mapa */}
      <div ref={containerRef} className="w-full h-full rounded-lg overflow-hidden" />
      
      {/* Instrucciones */}
      {selectingOrigin && mounted && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium z-[1000] flex items-center gap-2 animate-pulse">
          <Target size={18} />
          <span>Click en el mapa para establecer el punto de origen (0,0)</span>
        </div>
      )}
      
      {!selectingOrigin && coordinateSystem.origin && mounted && (
        <div className="absolute bottom-20 left-4 bg-white/90 backdrop-blur px-4 py-2 rounded-lg shadow-lg text-xs z-[1000]">
          <div className="font-semibold text-green-600 flex items-center gap-1 mb-1">
            <Target size={14} />
            Origen establecido
          </div>
          <div className="text-gray-600">
            Lat: {coordinateSystem.origin.lat.toFixed(6)}<br/>
            Lng: {coordinateSystem.origin.lng.toFixed(6)}
          </div>
        </div>
      )}
      
      {!selectingOrigin && vertices.length === 0 && onLocationSelect && mounted && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium z-[1000] flex items-center gap-2">
          <MapPin size={18} />
          <span>Click en el mapa para seleccionar la ubicación del terreno</span>
        </div>
      )}

      {!selectingOrigin && vertices.length >= 3 && mounted && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg text-sm font-medium z-[1000] flex items-center gap-2">
          <MapPin size={18} />
          <span>✓ Lote visualizado en el mapa</span>
        </div>
      )}
      
      {(!mounted || !mapRef.current) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <p className="text-gray-600">Cargando mapa...</p>
        </div>
      )}
    </div>
  );
}

// Exportar con dynamic para evitar SSR
export const MapView = dynamic(() => Promise.resolve(MapViewInner), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100">
      <p className="text-gray-600">Cargando mapa...</p>
    </div>
  ),
});
