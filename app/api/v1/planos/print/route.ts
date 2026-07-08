import { NextResponse } from "next/server";
import { renderToStream } from "@react-pdf/renderer";
import PlanoDocument from "@/components/planos/pdf/PlanoDocument";
import React from "react";
import proj4 from "proj4";
import { MapService } from "@/lib/services/MapService";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth/jwt";
import { getUtmProjString, DEFAULT_UTM_ZONE } from "@/lib/geometry/utmUtils";

export const dynamic = "force-dynamic";

const WGS84 = "EPSG:4326";
// Zona UTM centralizada en lib/geometry/utmUtils.ts (única fuente de verdad).
const UTM_18S = getUtmProjString(DEFAULT_UTM_ZONE);

export async function POST(req: Request) {
  try {
    // Requiere la sesión JWT real del usuario logueado (la misma que emite
    // /api/v1/auth/login), no un secreto compartido: este endpoint se llama
    // directo desde el navegador, así que cualquier token estático fijo
    // terminaría expuesto en el bundle/cliente (NEXT_PUBLIC_ o no).
    const bearerToken = extractTokenFromHeader(req.headers.get("authorization"));
    if (!bearerToken) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    try {
      verifyToken(bearerToken);
    } catch {
      return NextResponse.json({ error: "Sesión inválida o expirada" }, { status: 401 });
    }

    const data = await req.json();

    // The frontend sends INITIAL_DATA, but PlanoDocument expects a flattened PlanoDocumentProps interface.
    // We map the incoming structure to match the exact props expected by the PDF generator.
    const mappedProps = {
      ...data,
      modoUbicacion:
        data.config?.modoUbicacion || data.modoUbicacion || "vectorial",
      fecha: data.membrete?.fecha || data.fecha,
      escala: data.membrete?.escala || data.escala,
      lamina: data.membrete?.lamina || data.lamina,

      // Ensure we convert the lotesAdyacentes object dict back into the array React-PDF expects
      lotesAdyacentes: Array.isArray(data.lotesAdyacentes)
        ? data.lotesAdyacentes
        : data.lotesAdyacentes || data.AdjacentLots
          ? Object.values(data.lotesAdyacentes || data.AdjacentLots)
              .filter(Boolean)
              .map((a: any) => ({
                id: a.lote || a.Lot || a.id,
                vertices: a.vertices || a.Vertices || [],
              }))
          : [],
    };

    // If printing Satellite Mode but no satelliteUrl was passed (e.g. from Postman tests directly using INITIAL_DATA)
    // We autonomously build it exactly like the frontend Leaflet preview does!
    if (mappedProps.modoUbicacion === "satelital" && !mappedProps.satelliteUrl && mappedProps.vertices?.length > 0) {
      try {
        console.log("Generando mapa satelital Server-Side...");
        const latLngs = mappedProps.vertices.map((v: any) => {
          const [lng, lat] = proj4(UTM_18S, WGS84, [v.x, v.y]);
          return [lat, lng] as [number, number];
        });

        // Parse adjacent lots optionally
        const adyacentesPolys = mappedProps.lotesAdyacentes
          .filter((a: any) => a.vertices && a.vertices.length > 0)
          .map((a: any) => a.vertices.map((v: any) => {
            const [lng, lat] = proj4(UTM_18S, WGS84, [v.x, v.y]);
            return [lat, lng] as [number, number];
          }));

        mappedProps.satelliteUrl = await MapService.getStaticMapWithPolygon(
          latLngs, 250, 250, 17, 2, "satellite", adyacentesPolys
        );
      } catch (err) {
        console.warn("Server-Side Google Maps API Fallback Error:", err);
      }
    }

    // Render the React PDF component to a Node stream securely using React.createElement
    // (since route.ts is not a .tsx file, we avoid native JSX parsing issues)
    const pdfStream = await renderToStream(
      React.createElement(PlanoDocument, mappedProps as any) as any,
    );

    return new Response(pdfStream as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="plano_perimetrico.pdf"',
      },
    });
  } catch (error: any) {
    console.error("Error generating PDF endpoint:", error);

    return NextResponse.json(
      { error: "Failed to generate PDF document" },
      { status: 500 },
    );
  }
}
