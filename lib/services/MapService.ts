// src/lib/services/MapService.ts

// Key exclusiva de servidor. NUNCA usar el prefijo NEXT_PUBLIC_ aquí: Next.js
// inyecta esas variables en el bundle del navegador, y este servicio solo se
// invoca desde generadores server-side (API routes / worker de BullMQ).
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_SERVER_KEY;

export class MapService {
  /**
   * Obtiene una imagen satelital/callejero limpia con el POLÍGONO PINTADO por Google.
   * Esto garantiza alineación perfecta entre el dibujo y el mapa base.
   * * @param centerLat Latitud del centro (opcional si se pasa path, Google auto-centra)
   * @param centerLng Longitud del centro
   * @param vertices Array de [lat, lng] del polígono
   * @param width Ancho en px (max 640 para free tier)
   * @param height Alto en px
   */
  static async getStaticMapWithPolygon(
    vertices: Array<[number, number]>,
    width: number,
    height: number,
    zoom: number = 18,
    scale: number = 2, // @2x para pantallas retina (alta calidad en PDF)
    maptype: "roadmap" | "satellite" = "roadmap",
    adjacentPolygons?: Array<Array<[number, number]>>,
  ): Promise<string> {
    if (!GOOGLE_API_KEY) {
      console.warn(
        "GOOGLE_MAPS_SERVER_KEY no configurada; omitiendo mapa estático de Google (fallback a croquis vectorial).",
      );
      return "";
    }

    // 1. Validar dimensiones (Google Standard Tier limita a 640x640)
    const w = Math.min(width, 640);
    const h = Math.min(height, 640);

    // 2. Construir el "Path" (El Polígono)
    // Formato: color:0xRRGGBBAA|weight:N|fillcolor:0xRRGGBBAA|lat,lng|lat,lng...
    // Usamos Rojo semi-transparente para el relleno y rojo sólido para el borde
    const stylePoly = `color:0xFF0000FF|weight:2|fillcolor:0xFF000040`;

    // Serializar vértices (limitamos decimales para ahorrar caracteres en la URL)
    let coordsStr = vertices
      .map((v) => `${v[0].toFixed(6)},${v[1].toFixed(6)}`)
      .join("|");

    // Para cerrar el polígono visualmente, repetir el primer vértice al final
    if (vertices.length > 0) {
      coordsStr += `|${vertices[0][0].toFixed(6)},${vertices[0][1].toFixed(6)}`;
    }

    const pathParam = `path=${stylePoly}|${coordsStr}`;

    // Construir paths adicionales para los lotes colindantes
    let adjacentPaths = "";
    const styleAdjacent = `color:0xFFFF00FF|weight:1|fillcolor:0x00000000`; // Amarillo para el borde, sin relleno

    if (adjacentPolygons && adjacentPolygons.length > 0) {
      adjacentPaths = adjacentPolygons
        .map((poly) => {
          let adjCoordsStr = poly
            .map((v) => `${v[0].toFixed(6)},${v[1].toFixed(6)}`)
            .join("|");
          if (poly.length > 0) {
            adjCoordsStr += `|${poly[0][0].toFixed(6)},${poly[0][1].toFixed(6)}`;
          }
          return `&path=${styleAdjacent}|${adjCoordsStr}`;
        })
        .join("");
    }

    // 3. Estilos de Mapa "Ingeniería" (Clean)
    // Desaturado, sin etiquetas de negocios, carreteras simplificadas
    const mapStyles =
      maptype === "roadmap"
        ? [
            "style=feature:all|element:geometry|saturation:-100", // Escala de grises
            "style=feature:poi|element:labels|visibility:off", // Sin negocios/puntos de interés
            "style=feature:transit|element:labels|visibility:off", // Sin paradas de bus
            "style=feature:road|element:geometry|lightness:100|visibility:simplified", // Calles limpias
          ].join("&")
        : "";

    // 4. Construir URL Final
    // Nota: No enviamos 'center' ni 'zoom' obligatoriamente si hay 'path',
    // Google puede auto-ajustar, pero para mantener la escala técnica preferimos fijar el zoom si es posible.
    // Sin embargo, para "ubicación exacta", dejar que Google encuadre el path suele ser más seguro.
    // Aquí usaremos una lógica híbrida: Enviamos zoom para forzar detalle urbano.

    // Calculamos el centro aproximado para centrar la cámara
    const centerParam = `center=${vertices[0][0]},${vertices[0][1]}`; // Usamos el primer vértice o el centroide si lo tienes calculado fuera

    const baseUrl = `https://maps.googleapis.com/maps/api/staticmap`;

    // Si queremos un radio de 200m en satélite, bajamos un poco el zoom si se especifica satélite (auto-encuadre también funciona bien)
    // Zoom 18 es muy detallado, Zoom 17 es aprox 200m
    const finalZoom = maptype === "satellite" ? 17 : zoom;
    const stylesParam = mapStyles ? `&${mapStyles}` : "";

    const finalUrl = `${baseUrl}?size=${w}x${h}&scale=${scale}&maptype=${maptype}&zoom=${finalZoom}${adjacentPaths}&${pathParam}${stylesParam}&key=${GOOGLE_API_KEY}`;
    try {
      const response = await fetch(finalUrl);
      if (!response.ok) {
        console.error("Google Maps API Error:", response.statusText);
        throw new Error("Error fetching map");
      }
      const blob = await response.blob();
      return await this.blobToBase64(blob);
    } catch (error) {
      console.warn("Fallo al obtener mapa estático:", error);
      return ""; // Fallback silencioso
    }
  }

  /**
   * Obtiene la imagen del mapa como ArrayBuffer (Ideal para Node.js/jsPDF)
   */
  static async getStaticMapBuffer(
    vertices: Array<[number, number]>,
    width: number,
    height: number,
    zoom: number = 18,
    scale: number = 2,
    maptype: "roadmap" | "satellite" = "roadmap",
    adjacentPolygons?: Array<Array<[number, number]>>,
    signal?: AbortSignal,
  ): Promise<{ data: Uint8Array; mimeType: string } | null> {
    if (!GOOGLE_API_KEY) {
      console.warn(
        "GOOGLE_MAPS_SERVER_KEY no configurada; omitiendo mapa estático de Google (fallback a croquis vectorial).",
      );
      return null;
    }

    const w = Math.min(width, 640);
    const h = Math.min(height, 640);
    const stylePoly = `color:0xFF0000FF|weight:2|fillcolor:0xFF000040`;
    let coordsStr = vertices.map((v) => `${v[0].toFixed(6)},${v[1].toFixed(6)}`).join("|");
    if (vertices.length > 0) coordsStr += `|${vertices[0][0].toFixed(6)},${vertices[0][1].toFixed(6)}`;
    const pathParam = `path=${stylePoly}|${coordsStr}`;

    let adjacentPaths = "";
    if (adjacentPolygons && adjacentPolygons.length > 0) {
      adjacentPaths = adjacentPolygons.map((poly) => {
        let adjCoordsStr = poly.map((v) => `${v[0].toFixed(6)},${v[1].toFixed(6)}`).join("|");
        if (poly.length > 0) adjCoordsStr += `|${poly[0][0].toFixed(6)},${poly[0][1].toFixed(6)}`;
        return `&path=color:0xFFFF00FF|weight:1|fillcolor:0x00000000|${adjCoordsStr}`;
      }).join("");
    }

    const finalZoom = maptype === "satellite" ? 17 : zoom;
    const baseUrl = `https://maps.googleapis.com/maps/api/staticmap`;
    const finalUrl = `${baseUrl}?size=${w}x${h}&scale=${scale}&maptype=${maptype}&zoom=${finalZoom}${adjacentPaths}&${pathParam}&key=${GOOGLE_API_KEY}`;

    try {
      const response = await fetch(finalUrl, { signal });
      if (!response.ok) return null;
      const buffer = await response.arrayBuffer();
      return {
        data: new Uint8Array(buffer),
        mimeType: response.headers.get("content-type") || "image/png",
      };
    } catch (e) {
      console.warn("Error fetching static map buffer:", e);
      return null;
    }
  }

  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      if (typeof window === "undefined") {
        blob.arrayBuffer().then((buffer) => {
          const base64 = Buffer.from(buffer).toString("base64");
          resolve(`data:${blob.type || "image/png"};base64,${base64}`);
        }).catch(reject);
      } else {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }
    });
  }
}

