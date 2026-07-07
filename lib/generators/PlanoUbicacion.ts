
import { jsPDF } from 'jspdf';
import { GenerarPlanosRequest, PlanoConfig } from '@/types/planos';
import { CADDrawing } from '@/lib/geometry/cadDrawing';
import { calculateCentroid, utmToLatLng, getBoundingBox } from '@/lib/geometry/utmUtils';
import { utmToPaper, utmToPaperRelative, metrosAPapel } from '@/lib/geometry/scaleUtils';
import { MapService } from '@/lib/services/MapService';

/**
 * Generador de Plano de Ubicación Profesional
 * Renderizado por capas con Estrategia de Prioridad:
 * 1. Vectores (Contexto Urbano) -> Calidad CAD
 * 2. Imagen (Captura Leaflet) -> Contexto Visual
 * 3. Mapa Server (Google/Mapbox) -> Fallback
 */
interface PerimetricoScaleSource {
  getEscalaUtilizada(): number | null;
}

export class PlanoUbicacionGenerator {
  private request: GenerarPlanosRequest;

  constructor(
    request: GenerarPlanosRequest,
    private config: PlanoConfig,
    private perimetricoSource?: PerimetricoScaleSource,
  ) {
    this.request = request;
  }

  async generate(pdf: jsPDF): Promise<void> {
    const { vertices, lote, dimensiones, propietario, contexto, imagenContexto } = this.request as any;
    const cad = new CADDrawing(pdf);
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    // ========== 1. CONFIGURACIÓN DE LAYOUT (A3 Landscape) ==========
    const rightColumnWidth = 135; 
    const margin = 10;
    const gap = 5;

    // Áreas de trabajo
    const drawingWidth = pageWidth - rightColumnWidth - (margin * 2) - gap;
    
    const drawingArea = {
      x: margin,
      y: margin,
      width: drawingWidth,
      height: pageHeight - (margin * 2)
    };

    // Áreas Columna Derecha
    const colX = pageWidth - rightColumnWidth - margin;
    const membreteHeight = 70;
    const infoHeight = 90;
    const coordsHeight = 50;
    const macroHeight = pageHeight - (margin * 2) - membreteHeight - infoHeight - coordsHeight - (gap * 3);

    const infoArea = { x: colX, y: margin, width: rightColumnWidth, height: infoHeight };
    const coordsArea = { x: colX, y: margin + infoHeight + gap, width: rightColumnWidth, height: coordsHeight };
    const macroArea = { x: colX, y: coordsArea.y + coordsHeight + gap, width: rightColumnWidth, height: macroHeight };
    const membreteArea = { x: colX, y: pageHeight - membreteHeight - margin, width: rightColumnWidth, height: membreteHeight };

    // ========== 2. DIBUJAR MARCO ==========
    this.drawProfessionalBorder(pdf, pageWidth, pageHeight);

    // ========== 3. CÁLCULO DE ESCALA (Contextual) ==========
    // A diferencia del perimétrico, aquí intentamos encuadrar a los VECINOS también.
    let verticesParaEscala = [...vertices];
    // Normalizar contexto (soporte para lotesVecinos y elementos)
    const vecinos = contexto?.lotesVecinos || (contexto as any)?.elementos || [];

    if (vecinos.length > 0) {
      vecinos.forEach((vecino: any) => {
        if (vecino.vertices) verticesParaEscala.push(...vecino.vertices);
      });
    }

    // Escala objetivo: mantener una proporción visual fija respecto al plano
    // perimétrico (ej. perimétrico 1/75 -> ubicación 1/1500, siempre x20),
    // para que ambos documentos "se sientan" consistentes entre sí en vez de
    // una escala arbitraria por lote. Si no hay perimétrico generado en este
    // expediente (config sin incluirPlanoPerimetrico), cae al auto-ajuste puro.
    const RATIO_UBICACION_SOBRE_PERIMETRICO = 20;
    const escalaPerimetrico = this.perimetricoSource?.getEscalaUtilizada() ?? null;
    const escalaObjetivo = escalaPerimetrico ? escalaPerimetrico * RATIO_UBICACION_SOBRE_PERIMETRICO : undefined;

    // Calculamos escala con un margen generoso (40mm) para ver calles aledañas.
    // Nunca queda por debajo de lo que se necesita para que todo el contexto
    // entre en el recuadro: si la proporción x20 se queda corta (vecindario
    // muy denso), se usa la escala real necesaria en su lugar.
    const { escala, escalaTexto } = this.calculateScaleForViewport(verticesParaEscala, drawingArea.width, drawingArea.height, 40, escalaObjetivo);
    
    // Centroide del dibujo
    const centroDrawing = calculateCentroid(vertices); // Centramos en NUESTRO lote, no en los vecinos
    const cx = drawingArea.x + drawingArea.width / 2;
    const cy = drawingArea.y + drawingArea.height / 2;
    
    // Necesitamos el offset entre el centroide real y el centro del papel
    // Nota: utmToPaper usa cx, cy como el punto donde va el centroide.

    // ========== 4. RENDERIZADO DEL CONTEXTO (Prioridades) ==========
    let fondoDibujado = false;

    // PRIORIDAD 1: VECTORES (Coordenadas de contexto)
    if (vecinos.length > 0) {
      // console.log('Ubicación: Prioridad 1 (Vectores)');
      this.renderVectorialContext(pdf, cad, vecinos, escala, cx, cy, centroDrawing);
      fondoDibujado = true;
    }
    // PRIORIDAD 2: IMAGEN (Captura de Pantalla)
    else if (imagenContexto && imagenContexto.data) {
      // console.log('Ubicación: Prioridad 2 (Imagen)');
      this.renderImageContext(pdf, imagenContexto.data, drawingArea);
      fondoDibujado = true;
    }
    // PRIORIDAD 3: MAPA SERVER (Google Static Maps)
    else {
      // console.log('Ubicación: Prioridad 3 (Mapa Server)');
      await this.renderMapServiceContext(pdf, drawingArea, vertices);
      fondoDibujado = true;
    }

    // ========== 5. RENDERIZADO LOTE PRINCIPAL (Protagonista) ==========
    
    // Grilla (Opcional en Ubicación si hay mapa, pero técnica si es vectorial)
    // En ubicación se suele poner una grilla más espaciada (cada 100m o 50m)
    this.drawGridContext(pdf, drawingArea, 50); // Grilla visual simple

    // Dibujar Lote Objetivo
    // En planos de ubicación, el lote se suele rellenar con un "Hatch" o color sólido destacado
    const paperPoints = utmToPaper(vertices, escala, cx, cy); // utmToPaper usa el centroide interno si no se pasa offset, ajustamos lógica abajo
    
    // Fix: utmToPaper necesita el centroide relativo
    // Reimplementamos transformación local para asegurar consistencia con el contexto
    // Fix: utmToPaper necesita el centroide relativo
    // Reimplementamos transformación local para asegurar consistencia con el contexto
    const fixedPaperPoints = utmToPaperRelative(vertices, centroDrawing, escala, cx, cy);

    cad.drawPolygon(fixedPaperPoints, { 
      strokeColor: '#000000', 
      lineWidth: 0.6, 
      fillColor: '#505050' // Gris oscuro sólido para destacar ubicación
    });

    // Norte
    cad.drawNorthSymbol(drawingArea.x + drawingArea.width - 30, drawingArea.y + 40, 25);

    // Título Central
    pdf.setFillColor(255, 255, 255);
    pdf.rect(drawingArea.x + drawingArea.width/2 - 40, drawingArea.y + 5, 80, 8, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    pdf.text('ESQUEMA DE LOCALIZACIÓN', drawingArea.x + drawingArea.width / 2, drawingArea.y + 10, { align: 'center' });

    // ========== 6. PANELES DERECHOS ==========
    this.drawGeneralData(pdf, infoArea, lote, dimensiones);
    this.drawCentroidTable(pdf, coordsArea, vertices);
    
    // Macrolocalización (Mapa esquemático más alejado)
    // Aquí podrías llamar a otra imagen estática con menos zoom
    this.drawMacrolocalization(pdf, macroArea);

    // Membrete
    this.drawProfessionalMembrete(pdf, membreteArea, lote, dimensiones, escalaTexto, propietario);
  }

  // ===========================================================================
  // ESTRATEGIAS DE CONTEXTO
  // ===========================================================================

  /** PRIORIDAD 1: Dibuja vecinos (Contexto Vectorial) */
  private renderVectorialContext(
    pdf: jsPDF, 
    cad: CADDrawing, 
    elementos: any[], 
    escala: number, 
    paperCx: number, 
    paperCy: number, 
    realCenter: [number, number]
  ) {
    elementos.forEach(el => {
      if (!el.vertices) return;

      // Transformación manual para asegurar que todo gire en torno al mismo centro (Lote Principal)
      // Usamos la nueva función centralizada para consistencia
      const pts = utmToPaperRelative(el.vertices, realCenter, escala, paperCx, paperCy);

      // Estilo Vecino
      const isAreaVerde = el.tipo === 'AREA_VERDE';
      cad.drawPolygon(pts, { 
        strokeColor: '#AAAAAA', 
        lineWidth: 0.2,
        fillColor: isAreaVerde ? '#F0FFF0' : undefined 
      });

      // Texto del vecino (Número de lote)
      if (el.texto) {
        const centro = calculateCentroid(el.vertices);
        const pdx = centro[0] - realCenter[0];
        const pdy = centro[1] - realCenter[1];
        const tx = paperCx + metrosAPapel(pdx, escala);
        const ty = paperCy - metrosAPapel(pdy, escala);

        pdf.setFontSize(7);
        pdf.setTextColor(100);
        pdf.text(el.texto, tx, ty, { align: 'center', baseline: 'middle' });
      }
    });
  }

  /** PRIORIDAD 2: Imagen Base64 */
  private renderImageContext(pdf: jsPDF, base64: string, area: any) {
    try {
      pdf.addImage(base64, 'PNG', area.x, area.y, area.width, area.height);
      // Overlay blanco suave
      pdf.saveGraphicsState();
      pdf.setGState(new (pdf as any).GState({ opacity: 0.3 }));
      pdf.setFillColor(255, 255, 255);
      pdf.rect(area.x, area.y, area.width, area.height, 'F');
      pdf.restoreGraphicsState();
    } catch (e) {
      console.error('Error dibujando imagen contexto:', e);
    }
  }

  /** PRIORIDAD 3: Mapa Server */
  private async renderMapServiceContext(pdf: jsPDF, area: any, vertices: [number, number][]) {
    try {
      const latLngs = vertices.map(v => utmToLatLng(v));
      // Zoom 17 o 18 es bueno para Ubicación (un poco más alejado que Perimétrico)
      const mapImage = await MapService.getStaticMapWithPolygon(latLngs, 800, 800, 17);
      if (mapImage) {
        pdf.addImage(mapImage, 'PNG', area.x, area.y, area.width, area.height);
        
        // Marco alrededor de la imagen
        pdf.setDrawColor(0);
        pdf.setLineWidth(0.4);
        pdf.rect(area.x, area.y, area.width, area.height);
      }
    } catch (e) {
      console.warn('Fallo mapa server:', e);
    }
  }

  // ===========================================================================
  // MÉTODOS AUXILIARES
  // ===========================================================================

  private calculateScaleForViewport(vertices: [number, number][], widthMm: number, heightMm: number, marginMm: number, escalaObjetivo?: number) {
    const bbox = getBoundingBox(vertices);
    const availWidth = widthMm - (marginMm * 2);
    const availHeight = heightMm - (marginMm * 2);

    // Protección contra dimensiones 0
    const w = bbox.width || 10;
    const h = bbox.height || 10;

    const scaleX = (w * 1000) / availWidth;
    const scaleY = (h * 1000) / availHeight;
    const rawScale = Math.max(scaleX, scaleY);

    // Escalas normalizadas para Ubicación (suelen ser mayores: 500, 1000, 5000)
    const standardScales = [100, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000, 7500, 10000];
    const snapUp = (n: number) => standardScales.find(s => s >= n) ?? Math.ceil(n / 500) * 500;

    // Escala mínima que efectivamente entra en el recuadro (nunca se puede
    // bajar de esto sin que el dibujo se desborde).
    const finalScaleNecesaria = snapUp(rawScale);

    // Si hay una escala objetivo (relación x20 con el perimétrico), se
    // respeta siempre que alcance para mostrar todo el contexto; si el
    // vecindario es más denso de lo que esa proporción permite, se usa la
    // necesaria en su lugar para no romper el dibujo.
    const finalScale = escalaObjetivo
      ? Math.max(snapUp(escalaObjetivo), finalScaleNecesaria)
      : finalScaleNecesaria;

    return { escala: finalScale, escalaTexto: `1/${finalScale}` };
  }

  private drawGridContext(pdf: jsPDF, area: any, step: number) {
     // Solo dibuja marcas en los bordes para no ensuciar el mapa
     pdf.setDrawColor(0);
     pdf.setLineWidth(0.5);
     pdf.rect(area.x, area.y, area.width, area.height);
     
     // Pequeñas marcas (ticks)
     const tickSize = 2;
     pdf.setLineWidth(0.2);
     for(let x = area.x; x <= area.x + area.width; x += 20) {
         pdf.line(x, area.y, x, area.y + tickSize);
         pdf.line(x, area.y + area.height, x, area.y + area.height - tickSize);
     }
     for(let y = area.y; y <= area.y + area.height; y += 20) {
         pdf.line(area.x, y, area.x + tickSize, y);
         pdf.line(area.x + area.width, y, area.x + area.width - tickSize, y);
     }
  }

  private drawProfessionalBorder(pdf: jsPDF, w: number, h: number) {
    pdf.setLineWidth(1); pdf.rect(5, 5, w - 10, h - 10);
    pdf.setLineWidth(0.2); pdf.rect(8, 8, w - 16, h - 16);
  }

  private drawGeneralData(pdf: jsPDF, area: any, lote: any, dimensiones: any) {
    const { x, y, width } = area;
    let currY = y;
    
    pdf.setFillColor(50, 50, 50); 
    pdf.rect(x, currY, width, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9); 
    pdf.setFont('helvetica', 'bold');
    pdf.text('DATOS GENERALES', x + width / 2, currY + 5, { align: 'center' });
    currY += 12;

    pdf.setTextColor(0); 
    pdf.setFontSize(8);
    
    const items = [
      { l: 'Departamento:', v: lote.ubicacion?.departamento || 'Lima' },
      { l: 'Provincia:', v: lote.ubicacion?.provincia || 'Lima' },
      { l: 'Distrito:', v: lote.ubicacion?.distrito || '---' },
      { l: 'Urbanización:', v: lote.ubicacion?.urbanizacion || '---' },
      { l: 'Manzana:', v: lote.manzana || '---' },
      { l: 'Lote Nº:', v: lote.numeroLote || '---' },
      { l: 'Zonificación:', v: 'RDM' }, // Dato estático o del JSON
      { l: 'Área Total:', v: `${dimensiones.area.toFixed(2)} m²` },
    ];
    
    items.forEach((item, i) => {
        if (i % 2 !== 0) { 
            pdf.setFillColor(245, 245, 245); 
            pdf.rect(x, currY - 4.5, width, 6, 'F'); 
        }
        pdf.setFont('helvetica', 'bold'); 
        pdf.text(item.l, x + 2, currY);
        pdf.setFont('helvetica', 'normal'); 
        pdf.text(item.v, x + width/2, currY);
        currY += 6;
    });
  }

  private drawCentroidTable(pdf: jsPDF, area: any, vertices: [number, number][]) {
    const centroid = calculateCentroid(vertices);
    const [lat, lng] = utmToLatLng(centroid);
    const { x, y, width } = area;
    let currY = y;

    pdf.setFillColor(50, 50, 50); 
    pdf.rect(x, currY, width, 8, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(9); 
    pdf.setFont('helvetica', 'bold');
    pdf.text('COORDENADAS CENTROIDE', x + width / 2, currY + 5, { align: 'center' });
    currY += 12;
    
    pdf.setTextColor(0); 
    pdf.setFontSize(8);
    
    // Fila 1: UTM
    pdf.setFillColor(240, 240, 240);
    pdf.rect(x, currY - 4, width, 14, 'F');
    pdf.setFont('helvetica', 'bold'); 
    pdf.text('SISTEMA WGS84 - ZONA 18S', x + width/2, currY, {align:'center'});
    
    currY += 6;
    pdf.setFont('helvetica', 'bold'); pdf.text('ESTE (X):', x + 5, currY);
    pdf.setFont('helvetica', 'normal'); pdf.text(centroid[0].toFixed(2), x + 40, currY);
    
    pdf.setFont('helvetica', 'bold'); pdf.text('NORTE (Y):', x + 70, currY);
    pdf.setFont('helvetica', 'normal'); pdf.text(centroid[1].toFixed(2), x + 105, currY);

    // Fila 2: Geográficas
    currY += 10;
    pdf.text(`Latitud: ${lat.toFixed(6)}°   Longitud: ${lng.toFixed(6)}°`, x + width/2, currY, {align:'center'});
  }

  private drawMacrolocalization(pdf: jsPDF, area: any) {
    const { x, y, width, height } = area;
    
    pdf.setDrawColor(0); 
    pdf.setLineWidth(0.3); 
    pdf.rect(x, y, width, height);
    
    // Header
    pdf.setFillColor(50, 50, 50); 
    pdf.rect(x, y, width, 6, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8); 
    pdf.text('MACRO LOCALIZACIÓN', x + width/2, y + 4, { align: 'center' });
    
    // Placeholder gráfico (Círculo con Límite Provincial esquemático)
    pdf.setDrawColor(200);
    pdf.circle(x + width/2, y + height/2 + 3, 20);
    pdf.setTextColor(150); 
    pdf.setFontSize(7); 
    pdf.text('LIMA METROPOLITANA', x + width/2, y + height/2 + 3, {align:'center'});
    
    // Punto rojo de "Usted está aquí"
    pdf.setFillColor(255, 0, 0);
    pdf.circle(x + width/2 + 5, y + height/2, 2, 'F');
  }

  private drawProfessionalMembrete(pdf: jsPDF, area: any, lote: any, dimensiones: any, escala: string, prop: any) {
    const { x, y, width: w, height: h } = area;
    pdf.setDrawColor(0); 
    pdf.setLineWidth(0.5); 
    pdf.rect(x, y, w, h);
    
    const leftW = w * 0.4; // Logo área
    pdf.line(x + leftW, y, x + leftW, y + h);

    // LOGO
    pdf.setTextColor(0); 
    pdf.setFontSize(16); 
    pdf.setFont('helvetica', 'bold');
    pdf.text('PLANO', x + leftW/2, y + 20, { align: 'center' });
    pdf.text('UBICACIÓN', x + leftW/2, y + 28, { align: 'center' });
    pdf.setFontSize(9);
    pdf.text('TERRA LIMA', x + leftW/2, y + 55, { align: 'center' });

    // INFO
    let lineY = y + 10;
    const infoX = x + leftW + 3;
    
    pdf.setFontSize(7);
    pdf.text(`PROPIETARIO:`, infoX, lineY); 
    pdf.setFont('helvetica', 'normal');
    pdf.text(prop?.nombre?.substring(0, 35) || '---', infoX, lineY + 4);
    
    lineY += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`DIRECCIÓN DEL PREDIO:`, infoX, lineY);
    pdf.setFont('helvetica', 'normal');
    // Usar dirección compuesta si existe, sino armarla
    const dir = lote.ubicacion?.direccion || `Mz. ${lote.manzana} Lote ${lote.numeroLote}`;
    pdf.text(dir, infoX, lineY + 4);
    
    lineY += 12;
    pdf.setFont('helvetica', 'bold');
    pdf.text(`PROYECTO:`, infoX, lineY);
    pdf.setFont('helvetica', 'normal');
    pdf.text(lote.etapa || 'Habilitación Urbana', infoX, lineY + 4);

    // Pie
    const footerY = y + h - 10;
    pdf.line(x + leftW, footerY, x + w, footerY);
    pdf.setFontSize(7);
    pdf.text(`FECHA: ${new Date().toLocaleDateString()}`, infoX, footerY + 7);
    pdf.text(`ESC: ${escala}`, x + w - 5, footerY + 7, { align: 'right' });
  }
}