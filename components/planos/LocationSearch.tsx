'use client';

import React, { useEffect, useRef } from 'react';

interface LocationSearchProps {
  onSelectLocation: (lat: number, lng: number) => void;
  ready: boolean;
}

export const LocationSearch = ({ onSelectLocation, ready }: LocationSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    if (!ready || !inputRef.current) return;

    const initAutocomplete = () => {
      try {
        // Usar el Autocomplete clásico (más estable y compatible)
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current!, {
          componentRestrictions: { country: 'pe' },
          fields: ['geometry.location', 'formatted_address'],
        });

        // Escuchar el evento de selección
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          
          if (place.geometry && place.geometry.location) {
            const lat = place.geometry.location.lat();
            const lng = place.geometry.location.lng();
            onSelectLocation(lat, lng);
          }
        });

        autocompleteRef.current = autocomplete;

      } catch (error) {
        console.error("Error al inicializar Places:", error);
      }
    };

    initAutocomplete();

    // Cleanup
    return () => {
      if (autocompleteRef.current) {
        google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [ready, onSelectLocation]);

  if (!ready) {
    return (
      <div className="p-2 text-xs text-slate-400 bg-slate-50 rounded border border-slate-200">
        Cargando motor de mapas...
      </div>
    );
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar dirección en Perú..."
        className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
    </div>
  );
};
