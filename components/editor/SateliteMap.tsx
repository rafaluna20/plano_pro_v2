"use client";

import React, { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { Vertice, LoteVecino, LoteAdyacente } from "@/app/hooks/useLoteData";
import { utmToLatLng } from "@/app/utils/geometry";

const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Polygon = dynamic(
  () => import("react-leaflet").then((mod) => mod.Polygon),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);

const MapUpdaterComponent = dynamic(
  () =>
    import("react-leaflet").then((mod) => {
      const { useMap } = mod;
      return function MapUpdater({ center }: { center: [number, number] }) {
        const map = useMap();
        useEffect(() => {
          if (center && map) {
            try {
              map.setView(center, 18);
            } catch (e) {
              console.error("Error actualizando vista del mapa:", e);
            }
          }
        }, [center, map]);
        return null;
      };
    }),
  { ssr: false }
);

interface SateliteMapProps {
  vertices: Vertice[];
  vecinos: LoteVecino[];
  lotesAdyacentes: Partial<Record<string, LoteAdyacente>>;
}

export default function SateliteMap({ vertices, vecinos, lotesAdyacentes }: SateliteMapProps) {
  const [L, setL] = useState<any>(null);

  useEffect(() => {
    // Cargar CSS
    const existingLink = document.querySelector('link[href*="leaflet.css"]');
    if (!existingLink) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Import dynamic de Leaflet SOLO en cliente
    import("leaflet").then((leaflet) => {
      setL(leaflet.default || leaflet);
    });
  }, []);

  if (!L || typeof window === "undefined" || vertices.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <span className="text-xs text-slate-400">Cargando mapa satelital...</span>
      </div>
    );
  }

  const icon = new L.Icon({
    iconUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41],
  });

  // Calculate Center
  const centerRawX = vertices.reduce((sum, v) => sum + v.x, 0) / vertices.length;
  const centerRawY = vertices.reduce((sum, v) => sum + v.y, 0) / vertices.length;
  const centerLatLng = utmToLatLng(centerRawX, centerRawY);
  
  const mainPolygon = vertices.map((v) => utmToLatLng(v.x, v.y));
  
  // Collect all adjacent polygons
  const adyacentesPolygons = [
    ...vecinos.map(v => v.vertices.map(pt => utmToLatLng(pt.x, pt.y))),
    ...Object.values(lotesAdyacentes)
      .filter((a): a is LoteAdyacente => !!a && a.vertices && a.vertices.length >= 3)
      .map((a) => a.vertices.map((pt) => utmToLatLng(pt.x, pt.y)))
  ];

  return (
    <div className="w-full h-full relative rounded border border-slate-300 overflow-hidden z-0">
      <MapContainer
        center={centerLatLng}
        zoom={20}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
        dragging={true}
        touchZoom={true}
        doubleClickZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxNativeZoom={19}
          maxZoom={24}
        />
        <MapUpdaterComponent center={centerLatLng} />
        
        {adyacentesPolygons.map((poly, idx) => (
          <Polygon
            key={`leaf-ady-${idx}`}
            positions={poly}
            pathOptions={{
              color: "#94a3b8",
              dashArray: "4, 4",
              weight: 2,
              fillColor: "#f8fafc",
              fillOpacity: 0.9,
            }}
          />
        ))}
        
        <Polygon
          positions={mainPolygon}
          pathOptions={{
            color: "red",
            fillColor: "orange",
            fillOpacity: 0.2,
          }}
        />
        
        <Marker position={centerLatLng} icon={icon} />
      </MapContainer>
      <div className="absolute top-2 right-2 bg-white/90 p-2 rounded shadow text-xs z-[1000]">
        Fuente: OpenStreetMap
      </div>
    </div>
  );
}
