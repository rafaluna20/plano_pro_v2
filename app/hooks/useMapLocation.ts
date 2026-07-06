"use client";

/**
 * useMapLocation.ts
 * Hook para búsqueda de ubicación OSM y traslación UTM.
 */

import { useState, useCallback } from "react";
import { toast } from "react-hot-toast";
import { latLngToUtm } from "@/app/utils/geometry";

export function useMapLocation(
  onLocationSelect: (utmX: number, utmY: number) => void
) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  const handleSearchOSM = useCallback(async () => {
    const query = searchQuery.trim();
    if (!query) return;
    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
        { headers: { "Accept-Language": "es" } }
      );
      const results = await response.json();

      if (results && results.length > 0) {
        const lat = parseFloat(results[0].lat);
        const lng = parseFloat(results[0].lon);
        const [utmX, utmY] = latLngToUtm(lat, lng);
        onLocationSelect(utmX, utmY);
        toast.success(
          `Ubicación: ${results[0].display_name.split(",")[0]}`,
          { duration: 3000 }
        );
      } else {
        toast.error("No se encontraron resultados para esa búsqueda.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al conectar con el servicio de búsqueda.");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, onLocationSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearchOSM();
    },
    [handleSearchOSM]
  );

  return {
    searchQuery,
    setSearchQuery,
    isSearching,
    handleSearchOSM,
    handleKeyDown,
  };
}
