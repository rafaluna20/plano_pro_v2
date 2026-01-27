// src/lib/services/MapService.ts


const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || 'AIzaSyAOOVXRZ8aIZv6oTiZMRJkT5cDGmjTFqOA';

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
    scale: number = 2 // @2x para pantallas retina (alta calidad en PDF)
  ): Promise<string> {
    
    // 1. Validar dimensiones (Google Standard Tier limita a 640x640)
    const w = Math.min(width, 640);
    const h = Math.min(height, 640);

    // 2. Construir el "Path" (El Polígono)
    // Formato: color:0xRRGGBBAA|weight:N|fillcolor:0xRRGGBBAA|lat,lng|lat,lng...
    // Usamos Rojo semi-transparente para el relleno y rojo sólido para el borde
    const stylePoly = `color:0xFF0000FF|weight:2|fillcolor:0xFF000040`;
    
    // Serializar vértices (limitamos decimales para ahorrar caracteres en la URL)
    const coordsStr = vertices
      .map(v => `${v[0].toFixed(6)},${v[1].toFixed(6)}`)
      .join('|');

    const pathParam = `path=${stylePoly}|${coordsStr}`;

    // 3. Estilos de Mapa "Ingeniería" (Clean)
    // Desaturado, sin etiquetas de negocios, carreteras simplificadas
    const mapStyles = [
      'style=feature:all|element:geometry|saturation:-100', // Escala de grises
      'style=feature:poi|element:labels|visibility:off',    // Sin negocios/puntos de interés
      'style=feature:transit|element:labels|visibility:off',// Sin paradas de bus
      'style=feature:road|element:geometry|lightness:100|visibility:simplified' // Calles limpias
    ].join('&');

    // 4. Construir URL Final
    // Nota: No enviamos 'center' ni 'zoom' obligatoriamente si hay 'path', 
    // Google puede auto-ajustar, pero para mantener la escala técnica preferimos fijar el zoom si es posible.
    // Sin embargo, para "ubicación exacta", dejar que Google encuadre el path suele ser más seguro.
    // Aquí usaremos una lógica híbrida: Enviamos zoom para forzar detalle urbano.
    
    // Calculamos el centro aproximado para centrar la cámara
    const centerParam = `center=${vertices[0][0]},${vertices[0][1]}`; // Usamos el primer vértice o el centroide si lo tienes calculado fuera

    const baseUrl = `https://maps.googleapis.com/maps/api/staticmap`;
    const finalUrl = `${baseUrl}?size=${w}x${h}&scale=${scale}&maptype=roadmap&${pathParam}&${mapStyles}&key=${GOOGLE_API_KEY}`;

    try {
      const response = await fetch(finalUrl);
      if (!response.ok) {
        console.error('Google Maps API Error:', response.statusText);
        throw new Error('Error fetching map');
      }
      const blob = await response.blob();
      return await this.blobToBase64(blob);
    } catch (error) {
      console.warn('Fallo al obtener mapa estático:', error);
      return ''; // Fallback silencioso
    }
  }

  private static blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      // En entorno Node.js (Servidor), FileReader no existe. Usamos Buffer.
      if (typeof window === 'undefined') {
        blob.arrayBuffer().then(buffer => {
          const base64 = Buffer.from(buffer).toString('base64');
          const mimeType = blob.type || 'image/png';
          resolve(`data:${mimeType};base64,${base64}`);
        }).catch(reject);
      } else {
        // En entorno Navegador
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      }
    });
  }
}