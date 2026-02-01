/**
 * PlanoPerimetricoGeneratorV2.ts - Motor de Dibujo con Lógica Híbrida
 * 
 * VERSIÓN 2.0 - Generador Híbrido
 * 
 * MEJORAS SOBRE V1:
 * - Consume datos procesados del PlanoDataProcessor
 * - Usa longitudTexto registral (no calcula sobre el dibujo)
 * - Implementa Auto-Scale en plano de ubicación
 * - Muestra colindancias reales en cuadro técnico
 * - Escala dinámica basada en Bounding Box del contexto
 * 
 * FILOSOFÍA:
 * "El texto registral manda sobre el dibujo visual"
 * Si el registro dice "10.00m" pero el dibujo mide 9.98m, imprimimos "10.00m"
 */

import { jsPDF } from 'jspdf';
import { CADDrawing } from '@/lib/geometry/cadDrawing';
import { utmToPaper, metrosAPapel } from '@/lib/geometry/scaleUtils';
import { getBoundingBox, calculateCentroid } from '@/lib/geometry/utmUtils';
import { PLANO_THEME, getGridInterval } from '@/lib/config/PlanoTheme';
import type {
  PlanoPayloadHibrido,
  LinderoRegistral
} from '@/types/PlanosPayload';
import type { DatosProcesados } from '@/lib/services/PlanoDataProcessor';
import * as turf from '@turf/turf';

// ============================================================================
// TIPOS INTERNOS
// ============================================================================

interface AreaDibujo {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface EscalaCalculada {
  escala: number;
  escalaTexto: string;
}

// ============================================================================
// CLASE PRINCIPAL
// ============================================================================

export class PlanoPerimetricoGeneratorV2 {
  private payload: PlanoPayloadHibrido;
  private datosProcesados: DatosProcesados;
  private colorCache: { header: { r: number; g: number; b: number } };

  constructor(payload: PlanoPayloadHibrido, datosProcesados: DatosProcesados) {
    this.payload = payload;
    this.datosProcesados = datosProcesados;
    // Pre-calcular colores para evitar conversiones repetidas
    this.colorCache = {
      header: this.hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER)
    };
  }

  /**
   * Método principal de generación
   */
  async generate(pdf: jsPDF): Promise<void> {
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    // ========== 1. DEFINICIÓN DE LAYOUT ==========
    const layout = this.defineLayout(pageWidth, pageHeight);

    // ========== 2. MARCO GLOBAL ==========
    this.drawProfessionalBorder(pdf, pageWidth, pageHeight);

    // ========== 3. EXTRAER VÉRTICES DEL LOTE (EXCLUIR PUNTO DE CIERRE) ==========
    const vertices = this.payload.loteObjetivo.geometry.coordinates[0];
    // GeoJSON requiere que el primer y último punto sean iguales (cierre)
    // Excluimos el último punto para evitar duplicados en el dibujo
    const utmVertices = vertices.slice(0, -1).map(coord => coord as [number, number]);

    // ========== 4. CÁLCULO DE ESCALA PARA ÁREA PRINCIPAL ==========
    const escalaMain = this.calculateScaleForViewport(
      utmVertices,
      layout.drawingArea.width,
      layout.drawingArea.height,
      PLANO_THEME.LAYOUT.DIBUJO.MARGEN_INTERNO
    );

    const centerX = layout.drawingArea.x + layout.drawingArea.width / 2;
    const centerY = layout.drawingArea.y + layout.drawingArea.height / 2;

    // ========== 5. RENDERIZADO DEL CONTEXTO (FONDO) ==========
    const cad = new CADDrawing(pdf);
    this.renderContext(pdf, cad, utmVertices, escalaMain.escala, centerX, centerY);

    // ========== 6. RENDERIZADO TÉCNICO (CAPA SUPERIOR) ==========

    // A. Grilla UTM
    this.drawRealUTMGrid(pdf, layout.drawingArea, utmVertices, escalaMain.escala, centerX, centerY);

    // B. Lote Principal (Polígono grueso destacado)
    const paperPoints = utmToPaper(utmVertices, escalaMain.escala, centerX, centerY);
    cad.drawPolygon(paperPoints, {
      lineWidth: PLANO_THEME.STROKES.LOTE_BOUNDARY,
      strokeColor: PLANO_THEME.COLORS.PRIMARY,
      fillColor: PLANO_THEME.COLORS.MAIN_LOTE_FILL // Sombreado profesional solicitado
    });

    // C. Etiqueta Central (Lote + Área + Perímetro)
    this.drawPolygonCentralData(pdf, paperPoints);

    // D. Datos Topográficos (Cotas con texto REGISTRAL, Vértices, Ángulos)
    this.drawVerticesAndDimensions(pdf, paperPoints, cad);

    // E. Título y Norte
    this.drawTitle(pdf, layout.drawingArea, 'PLANO PERIMÉTRICO');
    this.drawNorthCatastro(
      pdf,
      layout.drawingArea.x + layout.drawingArea.width - PLANO_THEME.NORTE.OFFSET_X,
      layout.drawingArea.y + PLANO_THEME.NORTE.OFFSET_Y,
      PLANO_THEME.NORTE.SIZE
    );

    // ========== 7. COLUMNA DERECHA (Información) ==========

    // 1. Título Superior
    this.drawHeaderTitleBar(pdf, layout.titleBarArea);

    // 2. Plano de Ubicación (CON AUTO-SCALE)
    this.drawLocationPlanAutoScale(pdf, layout.ubicacionArea, utmVertices);

    // 3. Cuadro Técnico (CON DATOS PROCESADOS)
    this.drawTechnicalTableHybrid(pdf, layout.technicalTableArea, utmVertices);

    // 4. Membrete Profesional
    this.drawProfessionalMembrete(pdf, layout.membreteArea, escalaMain.escalaTexto);
  }

  // ==========================================================================
  // LAYOUT
  // ==========================================================================

  private defineLayout(pageWidth: number, pageHeight: number) {
    const { LAYOUT } = PLANO_THEME;
    const rightColumnWidth = LAYOUT.COLUMNA_DERECHA_ANCHO;
    const margin = LAYOUT.MARGENES.IZQUIERDO;
    const gap = LAYOUT.GAP;

    const colX = pageWidth - rightColumnWidth - margin;

    const titleBarHeight = LAYOUT.ALTURAS.HEADER;
    const ubicacionHeight = LAYOUT.ALTURAS.UBICACION;
    const membreteHeight = LAYOUT.ALTURAS.MEMBRETE;

    const cuadroTecnicoHeight = pageHeight - (margin * 2) - titleBarHeight - ubicacionHeight - membreteHeight - (gap * 3);

    return {
      titleBarArea: { x: colX, y: margin, width: rightColumnWidth, height: titleBarHeight },
      ubicacionArea: { x: colX, y: margin + titleBarHeight + gap, width: rightColumnWidth, height: ubicacionHeight },
      technicalTableArea: { x: colX, y: margin + titleBarHeight + gap + ubicacionHeight + gap, width: rightColumnWidth, height: cuadroTecnicoHeight },
      membreteArea: { x: colX, y: pageHeight - membreteHeight - margin, width: rightColumnWidth, height: membreteHeight },
      drawingArea: {
        x: margin,
        y: margin,
        width: colX - margin - gap,
        height: pageHeight - (margin * 2)
      }
    };
  }

  // ==========================================================================
  // RENDERIZADO DEL CONTEXTO
  // ==========================================================================

  private renderContext(
    pdf: jsPDF,
    cad: CADDrawing,
    mainVertices: [number, number][],
    escala: number,
    centerX: number,
    centerY: number
  ): void {
    const centroUtm = calculateCentroid(mainVertices);

    // Renderizar features del contexto
    this.payload.contexto.features.forEach(feature => {
      if (feature.geometry.type !== 'Polygon') return;

      const coords = feature.geometry.coordinates[0] as [number, number][];
      const paperPoints = coords.map(coord => {
        const dx = (coord[0] - centroUtm[0]) * (1000 / escala);
        const dy = (coord[1] - centroUtm[1]) * (1000 / escala);
        return [centerX + dx, centerY - dy] as [number, number];
      });

      // Diferenciar entre calles y lotes
      if (feature.properties.tipo === 'calle') {
        cad.drawPolygon(paperPoints, {
          strokeColor: PLANO_THEME.COLORS.SECONDARY,
          lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
          fillColor: '#F9F9F9'
        });
      } else {
        cad.drawPolygon(paperPoints, {
          strokeColor: PLANO_THEME.COLORS.NEIGHBOR_STROKE,
          lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
          fillColor: PLANO_THEME.COLORS.NEIGHBOR_FILL
        });

        // Etiqueta del lote vecino
        if (feature.properties.numeroLote) {
          const center = this.calculateVisualCenter(paperPoints);
          pdf.setTextColor(parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16));
          pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
          pdf.text(feature.properties.numeroLote, center.x, center.y, { align: 'center' });
        }
      }
    });
  }

  // ==========================================================================
  // PLANO DE UBICACIÓN CON AUTO-SCALE (MEJORA CRÍTICA)
  // ==========================================================================

  /**
   * Plano de Ubicación con Auto-Scale Inteligente
   * Calcula el Bounding Box del contexto completo y ajusta la escala dinámicamente
   */

















  // ==========================================================================
  // 3. PLANO DE UBICACIÓN AUTO-SCALE (CORREGIDO)
  // ==========================================================================

  private drawLocationPlanAutoScale(pdf: jsPDF, area: AreaDibujo, mainVertices: [number, number][]): void {
    const { UBICACION } = PLANO_THEME;

    // Header y Marco
    this.drawLocationHeader(pdf, area);

    const headerH = UBICACION.HEADER_HEIGHT;
    const drawX = area.x + 0.5;
    const drawY = area.y + headerH + 0.5;
    const drawW = area.width - 1;
    const drawH = area.height - headerH - 1;

    // Clipping (Mascara de recorte) - Construcción manual del path para asegurar que NO se dibuje borde
    pdf.saveGraphicsState();
    pdf.moveTo(drawX, drawY);
    pdf.lineTo(drawX + drawW, drawY);
    pdf.lineTo(drawX + drawW, drawY + drawH);
    pdf.lineTo(drawX, drawY + drawH);
    pdf.lineTo(drawX, drawY); // Cerrar
    // No llamamos a stroke() ni fill(), solo clip()
    pdf.clip();

    // 1. Recolectar todas las coordenadas (Contexto + Lote) para calcular el BBox Global
    const allCoords: [number, number][] = [...mainVertices];
    if (this.payload.contexto && this.payload.contexto.features) {
      this.payload.contexto.features.forEach(f => {
        if (f.geometry.type === 'Polygon') {
          // Aplanar array de coordenadas
          allCoords.push(...(f.geometry.coordinates[0] as [number, number][]));
        }
      });
    }

    // 2. Calcular Escala (Prioridad: que TODO quepa, idealmente en 1/2000)
    const bbox = getBoundingBox(allCoords);
    const contentW = (bbox.maxX - bbox.minX) || 50;
    const contentH = (bbox.maxY - bbox.minY) || 50;

    const marginFactor = UBICACION.MARGIN_FACTOR;

    // Calcular escala mínima necesaria para que TODO quepa (Auto-fit)
    const scaleX = (drawW * marginFactor) / contentW;
    const scaleY = (drawH * marginFactor) / contentH;
    const autoFitScale = Math.min(scaleX, scaleY);

    // Escala deseada: 1/2000 (0.5 mm/metro)
    const SCALE_2000 = 0.5;

    // LÓGICA: Elegir la escala MENOR (zomm out) para asegurar que quepa
    // SCALE_2000 = 0.5 (Zoom mayor)
    // autoFitScale = e.g. 0.05 (Zoom menor, para que quepa todo)
    // Debemos elegir el MENOR valor para alejar el zoom lo suficiente
    const scale = Math.min(SCALE_2000, autoFitScale);

    // Texto de Escala aproximada en la esquina
    const escalaNominal = Math.round(1000 / (scale / (1000 / 25.4)));
    pdf.setFontSize(6);
    pdf.setTextColor(0);
    pdf.text(`(E Aprox 1:${escalaNominal})`, area.x + area.width - 20, area.y + 3.5);

    // 3. Transformación de Coordenadas (UTM -> Papel)
    const bboxCX = (bbox.minX + bbox.maxX) / 2;
    const bboxCY = (bbox.minY + bbox.maxY) / 2;
    const pdfCX = drawX + (drawW / 2);
    const pdfCY = drawY + (drawH / 2);

    const transform = (p: [number, number]) => {
      const dx = (p[0] - bboxCX) * scale;
      const dy = (p[1] - bboxCY) * scale; // Invertir Y porque en PDF Y crece hacia abajo
      return [pdfCX + dx, pdfCY - dy] as [number, number];
    };

    // 4. DIBUJO ROBUSTO (SIN PDF.LINES) - Contexto (Vecinos/Calles)
    if (this.payload.contexto && this.payload.contexto.features) {
      this.payload.contexto.features.forEach(feature => {
        if (feature.geometry.type !== 'Polygon') return;
        const coords = feature.geometry.coordinates[0] as [number, number][];

        // Transformar todos los puntos
        const pts = coords.map(transform);

        if (pts.length < 2) return;

        const isCalle = feature.properties.tipo === 'calle';

        // Configurar estilos según tipo
        pdf.setDrawColor(150);
        pdf.setLineWidth(isCalle ? 0.1 : 0.05);
        // Calles casi blancas, Lotes con color muy suave
        pdf.setFillColor(isCalle ? 250 : 255, isCalle ? 250 : 255, isCalle ? 250 : 255);

        // Dibujo manual de polígono (Más seguro que pdf.lines)
        // Esto evita que el dibujo salga disparado si el primer punto es lejano
        pdf.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) {
          pdf.lineTo(pts[i][0], pts[i][1]);
        }
        pdf.close(); // Cierra el camino
        pdf.fillStroke(); // Dibuja borde y relleno
      });
    }

    // 5. DIBUJO ROBUSTO - Lote Principal (Destacado)
    const lotePts = mainVertices.map(transform);
    if (lotePts.length > 2) {
      pdf.setDrawColor(0); // Negro
      pdf.setLineWidth(0.3); // Borde medio
      pdf.setFillColor(80, 80, 80); // Gris oscuro destacado

      pdf.moveTo(lotePts[0][0], lotePts[0][1]);
      for (let i = 1; i < lotePts.length; i++) {
        pdf.lineTo(lotePts[i][0], lotePts[i][1]);
      }
      pdf.close();
      pdf.fillStroke();
    }

    // Restaurar estado gráfico (Quitar clipping)
    pdf.restoreGraphicsState();

    // Norte pequeño en la esquina superior derecha del croquis
    this.drawNorthCatastro(pdf, area.x + area.width - 8, area.y + 15, 8);
  }

  private drawLocationHeader(pdf: jsPDF, area: AreaDibujo) {
    const { UBICACION } = PLANO_THEME;
    // Marco exterior
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(area.x, area.y, area.width, area.height);

    // Barra de título
    pdf.setFillColor(this.colorCache.header.r, this.colorCache.header.g, this.colorCache.header.b);
    pdf.rect(area.x, area.y, area.width, UBICACION.HEADER_HEIGHT, 'F');

    // Texto
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('CROQUIS DE UBICACIÓN', area.x + area.width / 2, area.y + 3.5, { align: 'center' });
  }















  /**
   * Calcula escala automática para el plano de ubicación
   */
  private calculateAutoScaleForContext(mainVertices: [number, number][]): number {
    const allCoords: [number, number][] = [...mainVertices];
    this.payload.contexto.features.forEach(feature => {
      if (feature.geometry.type === 'Polygon') {
        const coords = feature.geometry.coordinates[0] as [number, number][];
        allCoords.push(...coords);
      }
    });

    const bbox = this.getBoundingBoxFromCoords(allCoords);
    const maxDim = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY);

    // Escala inteligente basada en dimensión
    if (maxDim > 500) return 5000;
    if (maxDim > 200) return 2500;
    if (maxDim > 100) return 1000;
    if (maxDim > 50) return 500;
    return 200;
  }

  // ==========================================================================
  // CUADRO TÉCNICO CON DATOS HÍBRIDOS
  // ==========================================================================

  /**
   * Dibuja cuadro técnico usando datos procesados (REGISTRAL > CALCULADO)
   */
  private drawTechnicalTableHybrid(pdf: jsPDF, area: AreaDibujo, vertices: [number, number][]): void {
    const { TABLA_TECNICA } = PLANO_THEME;
    const { x, y: startY, width: w } = area;
    let y = startY;

    // Header
    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, w, TABLA_TECNICA.HEADER_HEIGHT, 'F');
    pdf.setTextColor(255);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('CUADRO DE DATOS TÉCNICOS (WGS84)', x + w / 2, y + 4, { align: 'center' });
    y += TABLA_TECNICA.HEADER_HEIGHT;

   
    // Sub-header - Con columnas: VERT, LADO, DIST, ANG, COLINDANCIA, ESTE, NORTE
    const cols = ['V.', 'LADO', 'DIST.', 'ANG.', 'COLINDANCIA', 'ESTE (X)', 'NORTE (Y)'];
    // Ajuste de anchos: DIST y ANG +30% (aprox). V, ESTE, NORTE reducidos para compensar.
    const colW = [6, 10, 14, 13, 19, 20, 20].map(p => (w * p) / 100);

    const headerColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER);
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.setDrawColor(0);
    pdf.rect(x, y, w, TABLA_TECNICA.SUBHEADER_HEIGHT, 'FD');
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

    let cx = x;
    cols.forEach((c: string, i: number) => {
      pdf.text(c, cx + colW[i] / 2, y + 3.5, { align: 'center' });
      // Linea vertical (separador derecho)
      pdf.line(cx + colW[i], y, cx + colW[i], y + TABLA_TECNICA.SUBHEADER_HEIGHT);
      cx += colW[i];
    });
    y += TABLA_TECNICA.SUBHEADER_HEIGHT;

    // Filas de datos (USANDO LINDEROS PROCESADOS)
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

    // CALCULO DE GEOMETRÍA: Determinar area y orientación para ángulos correctos
    let signedArea = 0;
    for (let j = 0; j < vertices.length; j++) {
      const p1 = vertices[j];
      const p2 = vertices[(j + 1) % vertices.length];
      signedArea += (p1[0] * p2[1] - p2[0] * p1[1]);
    }
    const isPositiveArea = signedArea > 0;

    let totalLength = 0;
    let totalAngle = 0;

    const toDMS = (deg: number): string => {
      let d = Math.floor(deg);
      let mFloat = (deg - d) * 60;
      let m = Math.floor(mFloat);
      let s = Math.round((mFloat - m) * 60);

      if (s === 60) { s = 0; m++; }
      if (m === 60) { m = 0; d++; }

      return `${d}°${String(m).padStart(2, '0')}'${String(s).padStart(2, '0')}"`;
    };

    this.datosProcesados.linderosFinal.forEach((lindero: LinderoRegistral, i: number) => {
      // Zebra striping
      if (i % 2 === 0) {
        pdf.setFillColor(255, 255, 255);
      } else {
        const zebraColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_ZEBRA);
        pdf.setFillColor(zebraColor.r, zebraColor.g, zebraColor.b);
      }
      pdf.rect(x, y, w, TABLA_TECNICA.ROW_HEIGHT, 'FD');

      cx = x;
      const cellY = y + 3;

      const drawCell = (txt: string, width: number, size: number = PLANO_THEME.FONTS.SIZES.SMALL) => {
        pdf.setFontSize(size);
        pdf.text(txt, cx + width / 2, cellY, { align: 'center' });
        // Linea vertical (separador derecho)
        pdf.line(cx + width, y, cx + width, y + TABLA_TECNICA.ROW_HEIGHT);
        cx += width;
      };

      const vertexIdx = lindero.index;
      const nextIdx = (vertexIdx + 1) % vertices.length;

      drawCell(`V${vertexIdx + 1}`, colW[0]);
      drawCell(lindero.tramo, colW[1]);
      // ⭐ USAR longitudTexto REGISTRAL (no calcular)
      const lenVal = parseFloat(lindero.longitudTexto);
      totalLength += isNaN(lenVal) ? 0 : lenVal;
      drawCell(lindero.longitudTexto + 'm', colW[2]);

      // ⭐ MOSTRAR ángulo interno calculado (ROBUSTO)
      // Recalcular usando vertexIdx (ya definido arriba)
      const cur = vertices[vertexIdx];
      const prev = vertices[(vertexIdx - 1 + vertices.length) % vertices.length];
      const next = vertices[(vertexIdx + 1) % vertices.length];

      const aPrev = Math.atan2(prev[1] - cur[1], prev[0] - cur[0]);
      const aNext = Math.atan2(next[1] - cur[1], next[0] - cur[0]);

      // Formula invariante: Si el area es positiva, ángulo = prev - next
      let angRad = isPositiveArea ? (aPrev - aNext) : (aNext - aPrev);
      if (angRad < 0) angRad += Math.PI * 2;
      const angDeg = angRad * (180 / Math.PI);

      totalAngle += angDeg;

      drawCell(toDMS(angDeg), colW[3]);
      // ⭐ MOSTRAR colindanciaTexto
      drawCell(lindero.colindanciaTexto, colW[4], 5); // Fuente más pequeña para colindancia
      drawCell(vertices[vertexIdx][0].toFixed(2), colW[5]);
      drawCell(vertices[vertexIdx][1].toFixed(2), colW[6]);

      y += TABLA_TECNICA.ROW_HEIGHT;
    });

    // DIBUJAR TOTALES
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.rect(x, y, w, TABLA_TECNICA.ROW_HEIGHT, 'FD');

    // Label "TOTAL"
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setTextColor(0); // Texto negro para lectura? O blanco si headerColor es oscuro. 
    // Nota: Header es azul oscuro. Totals suele ser destacado. Header usa TextColor 255 (Blanco)?
    // Line 446 setTextColor(255) for Header. Line 460 setTextColor(0) for Sub header.
    // Usaremos Blanco (255) si es fondo oscuro. headerColor es TABLE_HEADER.
    // Verifiquemos contraste. Asumo texto blanco similar al titulo principal.
    // Pero SUBHEADER usa headerColor? Line 457.
    // Line 460 setTextColor(0). 
    // Line 456 headerColor = TABLE_HEADER.
    // Si TABLE_HEADER es claro, usa negro.
    // Sigamos la convención del Subheader (line 460).
    pdf.setTextColor(0);

    // Centrar "TOTAL" en V. y LADO (col 0 y 1)
    const labelW = colW[0] + colW[1];
    pdf.text('TOTAL', x + labelW / 2, y + 3.5, { align: 'center' });

    // Suma Distancia
    let cxSum = x + colW[0] + colW[1];
    pdf.text(totalLength.toFixed(2) + 'm', cxSum + colW[2] / 2, y + 3.5, { align: 'center' });
    cxSum += colW[2];

    // Suma Angulos
    pdf.text(toDMS(totalAngle), cxSum + colW[3] / 2, y + 3.5, { align: 'center' });

    y += TABLA_TECNICA.ROW_HEIGHT;
  }

  // ==========================================================================
  // ETIQUETADO DE COTAS (USANDO TEXTO REGISTRAL)
  // ==========================================================================

  private drawInternalAngle(pdf: jsPDF, p: [number, number], prev: [number, number], next: [number, number], label: string, expectedVal: number): void {
    const radius = 4; // Radio del arco

    // Ángulos de los segmentos
    const aPrev = Math.atan2(prev[1] - p[1], prev[0] - p[0]);
    const aNext = Math.atan2(next[1] - p[1], next[0] - p[0]);

    // Calcular arco inicial (sentido horario por defecto en PDF, o CCW math)
    let startAngle = aNext;
    let endAngle = aPrev;

    // Sweep inicial
    let sweep = endAngle - startAngle;
    if (sweep < 0) sweep += Math.PI * 2;

    // Convertir sweep a grados para comparar con expectedVal
    // Nota: expectedVal siempre es ángulo interno (ej. 90, 60, 270 para cóncavo)
    const sweepDeg = sweep * (180 / Math.PI);

    // Comparar con expectedVal (tolerancia 5 grados)
    // Si la diferencia es grande, estamos dibujando el externo (reflex), así que invertimos
    const diff = Math.abs(sweepDeg - expectedVal);
    const reflexDiff = Math.abs((360 - sweepDeg) - expectedVal);

    // Si la versión 'reflex' (invertida) está más cerca del valor esperado, invertimos
    if (reflexDiff < diff) {
      const temp = startAngle;
      startAngle = endAngle;
      endAngle = temp;
      sweep = Math.PI * 2 - sweep;
    }

    // Dibujar
    const step = sweep / 8;
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.1);
    pdf.lines([], p[0] + Math.cos(startAngle) * radius, p[1] + Math.sin(startAngle) * radius); // Move

    for (let i = 1; i <= 8; i++) {
      const a = startAngle + step * i;
      const x = p[0] + Math.cos(a) * radius;
      const y = p[1] + Math.sin(a) * radius;
      pdf.line(p[0] + Math.cos(a - step) * radius, p[1] + Math.sin(a - step) * radius, x, y);
    }

    // Label del ángulo
    const midAngle = startAngle + sweep / 2;
    const lblX = p[0] + Math.cos(midAngle) * (radius + 2);
    const lblY = p[1] + Math.sin(midAngle) * (radius + 2);

    pdf.setFontSize(5);
    pdf.setTextColor(80);
    pdf.text(label, lblX, lblY, { align: 'center', baseline: 'middle' });
  }

  /**
   * Dibuja dimensiones de lados usando longitudTexto registral
   */


  private drawVerticesAndDimensions(pdf: jsPDF, paperPoints: [number, number][], cad: CADDrawing): void {
    // 1. Determinar Orientación del Polígono (Signed Area)
    // Area Positiva = CW (Clockwise) en sistema de pantalla (Y abajo)
    // Area Negativa = CCW (Counter-Clockwise)
    let signedArea = 0;
    for (let i = 0; i < paperPoints.length; i++) {
      const p1 = paperPoints[i];
      const p2 = paperPoints[(i + 1) % paperPoints.length];
      signedArea += (p1[0] * p2[1] - p2[0] * p1[1]);
    }
    const isCW = signedArea > 0;

    // Vértices y Ángulos
    paperPoints.forEach((p, i) => {
      // 1. Dibujar Ángulos Internos
      const prev = paperPoints[(i - 1 + paperPoints.length) % paperPoints.length];
      const next = paperPoints[(i + 1) % paperPoints.length];

      // Ángulos absolutos de los vectores hacia prev y next
      const aPrev = Math.atan2(prev[1] - p[1], prev[0] - p[0]);
      const aNext = Math.atan2(next[1] - p[1], next[0] - p[0]);

      // Calcular diferencia en sentido horario (Next -> Prev)
      let angle = aPrev - aNext;
      if (angle < 0) angle += Math.PI * 2;

      // Lógica de Interior:
      // Si el polígono es CW (sentido horario), el interior está a la DERECHA del recorrido.
      // El ángulo barrido desde Next hacia Prev en sentido horario ES el ángulo interno.
      // E.g. Cuadrado CW: Next(0°), Prev(-90°=270°). Diff = 270 - 0 = 270? No.
      // aPrev = -90, aNext = 0. Diff = -90 -> 270.
      // Cuadrado CW interno es 90.
      // Entonces para CW, el interno es (aNext - aPrev)?
      // aNext(0) - aPrev(-90) = 90. Correcto.

      let internalAngleRad = 0;

      if (isCW) {
        // Polígono Horario (Screen Y-Down): Interior = aPrev - aNext
        // E.g. Top-Right Corner (Prev=180, Next=90). Int=90.
        // 180 - 90 = 90. Correcto.
        internalAngleRad = aPrev - aNext;
      } else {
        // Polígono Anti-Horario: Interior = aNext - aPrev
        internalAngleRad = aNext - aPrev;
      }


      if (internalAngleRad < 0) internalAngleRad += Math.PI * 2;

      const computedAngle = internalAngleRad * (180 / Math.PI);
      const angleLabel = `${computedAngle.toFixed(2)}°`;

      // Dibujar usando este valor calculado localmente
      this.drawInternalAngle(pdf, p, prev, next, angleLabel, computedAngle);

      // 2. Dibujar Vértice
      cad.drawCircle(p[0], p[1], 0.8, { fillColor: PLANO_THEME.COLORS.WHITE });
      pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
      pdf.setTextColor(0);
      pdf.text(`V${i + 1}`, p[0] + 2, p[1] - 2);
    });

    // Cotas (dimensiones) - USANDO longitudTexto REGISTRAL
    this.datosProcesados.linderosFinal.forEach((lindero: LinderoRegistral, i: number) => {
      const p = paperPoints[i];
      const next = paperPoints[(i + 1) % paperPoints.length];
      const mx = (p[0] + next[0]) / 2;
      const my = (p[1] + next[1]) / 2;

      // Caja blanca de fondo
      pdf.setFillColor(255, 255, 255);
      pdf.rect(mx - 6, my - 2, 12, 4, 'F');

      pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
      pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);

      // ⭐ USAR longitudTexto del registro, NO calcular
      pdf.text(`${lindero.longitudTexto}m`, mx, my + 1, { align: 'center' });
    });
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  private drawPolygonCentralData(pdf: jsPDF, paperPoints: [number, number][]): void {
    const { ETIQUETA_CENTRAL } = PLANO_THEME;
    const center = this.calculatePoleOfInaccessibility(paperPoints);

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
    pdf.rect(center.x - ETIQUETA_CENTRAL.WIDTH / 2, center.y - ETIQUETA_CENTRAL.HEIGHT / 2,
      ETIQUETA_CENTRAL.WIDTH, ETIQUETA_CENTRAL.HEIGHT, 'FD');

    const loteProps = this.payload.loteObjetivo.properties;

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setTextColor(0);
    pdf.text(`LOTE ${loteProps.identificador.lote}`, center.x, center.y - 2, { align: 'center' });

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

    // ⭐ USAR datos procesados (registral > calculado)
    // Recalcular perímetro suma visual para coincidencia exacta
    const perimetroVisual = this.datosProcesados.linderosFinal.reduce((sum, l) => sum + parseFloat(l.longitudTexto), 0);

    pdf.text(`A = ${this.datosProcesados.areaFinal.toFixed(2)} m²`, center.x, center.y + 1, { align: 'center' });
    pdf.text(`P = ${perimetroVisual.toFixed(2)} ml`, center.x, center.y + ETIQUETA_CENTRAL.LINE_SPACING, { align: 'center' });
  }

  private drawHeaderTitleBar(pdf: jsPDF, area: AreaDibujo): void {
    const { x, y, width, height } = area;

    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, width, height, 'F');

    const splitX = x + (width * 0.70);

    pdf.setTextColor(255, 255, 255);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H2);
    pdf.text('PLANO PERIMÉTRICO Y UBICACIÓN', x + (splitX - x) / 2, y + height / 2 + 4, { align: 'center' });

    pdf.setDrawColor(255);
    pdf.setLineWidth(PLANO_THEME.STROKES.SEPARATOR);
    pdf.line(splitX, y, splitX, y + height);

    const codeAreaW = width - (splitX - x);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(splitX + 2, y + 2, codeAreaW - 4, height - 4, 'F');

    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.text('LÁMINA Nº', splitX + 5, y + 5);

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H3);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('PP-01', splitX + codeAreaW / 2 + 1, y + 9, { align: 'center' });

    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    const lineW = 10;
    const lineX = splitX + codeAreaW / 2 + 1 - lineW / 2;
    pdf.line(lineX, y + 9.5, lineX + lineW, y + 9.5);
  }

  private drawProfessionalMembrete(pdf: jsPDF, area: AreaDibujo, escala: string): void {
    const { x, y, width: w, height: h } = area;
    const { MEMBRETE } = PLANO_THEME;

    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(x, y, w, h);

    const colSplit = w * MEMBRETE.LOGO_COLUMN_PERCENT;
    pdf.line(x + colSplit, y, x + colSplit, y + h);

    // Logo
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H1);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('LOGO', x + colSplit / 2, y + h / 2 - 2, { align: 'center' });
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text('EMPRESA / ING.', x + colSplit / 2, y + h / 2 + 4, { align: 'center' });

    const startX = x + colSplit + MEMBRETE.PADDING_H;
    const lineHeight = h / MEMBRETE.NUM_FILAS;

    const loteProps = this.payload.loteObjetivo.properties;

    const drawRow = (idx: number, label: string, val: string) => {
      const rowY = y + (idx * lineHeight);
      if (idx > 0) {
        const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
        pdf.setDrawColor(grayVal);
        pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
        pdf.line(x + colSplit, rowY, x + w, rowY);
      }

      const dimmedVal = parseInt(PLANO_THEME.COLORS.DIMMED.slice(1, 3), 16);
      pdf.setTextColor(dimmedVal);
      pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
      pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
      pdf.text(label, startX, rowY + 3.5);

      pdf.setTextColor(0);
      // Usar drawTextAutoFit para valores largos (igual que PlanoPerimetrico.ts)
      this.drawTextAutoFit(pdf, val || '---', startX, rowY + 8, w - colSplit - MEMBRETE.PADDING_H * 2, PLANO_THEME.FONTS.SIZES.BODY);
    };

    drawRow(0, 'PROYECTO:', loteProps.identificador.urbanizacion || 'LEVANTAMIENTO TOPOGRÁFICO');
    drawRow(1, 'PROPIETARIO:', loteProps.titularidad?.nombre || '---');
    drawRow(2, 'UBICACIÓN:', `Mz. ${loteProps.identificador.manzana
      } Lt.${loteProps.identificador.lote} `);

    // Área y Perímetro
    const rowY4 = y + (3 * lineHeight);
    const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
    pdf.setDrawColor(grayVal);
    pdf.line(x + colSplit, rowY4, x + w, rowY4);

    const dimmedVal = parseInt(PLANO_THEME.COLORS.DIMMED.slice(1, 3), 16);
    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text('ÁREA:', startX, rowY4 + 3.5);
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(`${this.datosProcesados.areaFinal.toFixed(2)} m²`, startX, rowY4 + 8);

    const midX = startX + 30;
    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text('PERÍMETRO:', midX, rowY4 + 3.5);
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(`${this.datosProcesados.perimetroFinal.toFixed(2)} ml`, midX, rowY4 + 8);

    // Escala y Fecha
    const rowY5 = y + (4 * lineHeight);
    pdf.setDrawColor(grayVal);
    pdf.line(x + colSplit, rowY5, x + w, rowY5);

    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text('ESCALA:', startX, rowY5 + 3.5);
    pdf.text('FECHA:', midX, rowY5 + 3.5);

    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(escala, startX, rowY5 + 8);
    pdf.text(new Date().toLocaleDateString(), midX, rowY5 + 8);
  }

  private drawRealUTMGrid(
    pdf: jsPDF,
    area: AreaDibujo,
    vertices: [number, number][],
    escala: number,
    cx: number,
    cy: number
  ): void {
    const centroUtm = calculateCentroid(vertices);
    const interval = getGridInterval(escala);

    const viewWMeters = (area.width / 1000) * escala;
    const viewHMeters = (area.height / 1000) * escala;

    const minUtmX = centroUtm[0] - (viewWMeters / 2);
    const maxUtmX = centroUtm[0] + (viewWMeters / 2);
    const minUtmY = centroUtm[1] - (viewHMeters / 2);
    const maxUtmY = centroUtm[1] + (viewHMeters / 2);

    const startX = Math.ceil(minUtmX / interval) * interval;
    const startY = Math.ceil(minUtmY / interval) * interval;

    pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
    const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
    pdf.setDrawColor(grayVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

    // Líneas Verticales
    for (let x = startX; x <= maxUtmX; x += interval) {
      const px = cx + metrosAPapel(x - centroUtm[0], escala);
      if (px > area.x && px < area.x + area.width) {
        pdf.line(px, area.y, px, area.y + area.height);
        pdf.text(x.toString(), px - 2, area.y + area.height - 2, { angle: 90 });
      }
    }

    // Líneas Horizontales
    for (let y = startY; y <= maxUtmY; y += interval) {
      const py = cy - metrosAPapel(y - centroUtm[1], escala);
      if (py > area.y && py < area.y + area.height) {
        pdf.line(area.x, py, area.x + area.width, py);
        pdf.text(y.toString(), area.x + area.width - 2, py - 1, { align: 'right' });
      }
    }

    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(area.x, area.y, area.width, area.height);
  }

  private drawProfessionalBorder(pdf: jsPDF, w: number, h: number): void {
    const { MARCO } = PLANO_THEME.LAYOUT;

    pdf.setDrawColor(0);
    pdf.setLineWidth(MARCO.EXTERNO_WIDTH);
    pdf.rect(MARCO.EXTERNO_OFFSET, MARCO.EXTERNO_OFFSET,
      w - MARCO.EXTERNO_OFFSET * 2, h - MARCO.EXTERNO_OFFSET * 2);

    pdf.setLineWidth(MARCO.INTERNO_WIDTH);
    pdf.rect(MARCO.INTERNO_OFFSET, MARCO.INTERNO_OFFSET,
      w - MARCO.INTERNO_OFFSET * 2, h - MARCO.INTERNO_OFFSET * 2);
  }

  private drawTitle(pdf: jsPDF, area: AreaDibujo, title: string): void {
    const { TITULO } = PLANO_THEME;

    const centerX = area.x + area.width / 2;
    const titleY = area.y + area.height - TITULO.OFFSET_BOTTOM;

    pdf.setFillColor(255, 255, 255);
    const fontSize = PLANO_THEME.FONTS.SIZES.H1;
    const titleWidth = pdf.getStringUnitWidth(title) * fontSize / pdf.internal.scaleFactor;
    pdf.rect(centerX - titleWidth / 2 - TITULO.PADDING_H, titleY - TITULO.PADDING_V,
      titleWidth + TITULO.PADDING_H * 2, TITULO.BOX_HEIGHT, 'F');

    pdf.setFontSize(fontSize);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, centerX, titleY, { align: 'center' });
  }

  private drawNorthCatastro(pdf: jsPDF, x: number, y: number, s: number): void {
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.NORTH_ARROW);

    pdf.setFillColor(0, 0, 0);
    pdf.triangle(x, y - s / 2, x - s / 6, y, x + s / 6, y, 'F');

    pdf.setFillColor(255, 255, 255);
    pdf.triangle(x, y + s / 2, x - s / 6, y, x + s / 6, y, 'FD');

    pdf.line(x, y - s / 2, x, y + s / 2);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(s);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('N', x, y - s / 2 - 2, { align: 'center' });
  }

  private calculateScaleForViewport(
    vertices: [number, number][],
    w: number,
    h: number,
    m: number
  ): EscalaCalculada {
    const bbox = getBoundingBox(vertices);
    const scaleX = (bbox.width * 1000) / (w - m * 2);
    const scaleY = (bbox.height * 1000) / (h - m * 2);
    const raw = Math.max(scaleX, scaleY);

    const scales = [50, 75, 100, 125, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000];
    const final = scales.find(s => s >= raw) || Math.ceil(raw / 100) * 100;

    return { escala: final, escalaTexto: `1 / ${final} ` };
  }

  private calculatePoleOfInaccessibility(pts: [number, number][]): { x: number, y: number } {
    // 1. Intentar con el Centroide geométrico (promedio de vértices)
    const centroid = this.calculateVisualCenter(pts);

    // 2. Verificar si el centroide está dentro del polígono
    try {
      // Cerrar polígono para turf (requiere primer punto = último punto)
      const poly = turf.polygon([[...pts, pts[0]]]);
      const pt = turf.point([centroid.x, centroid.y]);

      // Si el centroide está dentro, es el mejor punto para la etiqueta
      if (turf.booleanPointInPolygon(pt, poly)) {
        return centroid;
      }
    } catch (error) {
      console.warn('Error verificando punto en polígono:', error);
    }

    // 3. Fallback: Si el centroide está fuera (ej. lote en U), usar centro del bounding box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  private calculateVisualCenter(pts: [number, number][]): { x: number, y: number } {
    let sx = 0, sy = 0;
    pts.forEach(p => { sx += p[0]; sy += p[1]; });
    return { x: sx / pts.length, y: sy / pts.length };
  }

  private getBoundingBoxFromCoords(coords: [number, number][]): {
    minX: number; maxX: number; minY: number; maxY: number;
  } {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    coords.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    return { minX, maxX, minY, maxY };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }

  /**
   * Método HELPER: TEXTO ADAPTATIVO (Copiado de PlanoPerimetrico.ts)
   * Ajusta el tamaño de la fuente automáticamente para que el texto quepa en el ancho dado.
   */
  private drawTextAutoFit(
    pdf: jsPDF,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    initialSize: number = PLANO_THEME.FONTS.SIZES.BODY
  ): void {
    let currentSize = initialSize;
    const minSize = PLANO_THEME.FONTS.SIZES.TINY;

    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(currentSize);

    while (pdf.getStringUnitWidth(text) * currentSize / pdf.internal.scaleFactor > maxWidth && currentSize > minSize) {
      currentSize -= 0.5;
      pdf.setFontSize(currentSize);
    }

    let finalText = text;
    const textWidth = pdf.getStringUnitWidth(text) * currentSize / pdf.internal.scaleFactor;
    if (textWidth > maxWidth) {
      while (pdf.getStringUnitWidth(finalText + '...') * currentSize / pdf.internal.scaleFactor > maxWidth && finalText.length > 0) {
        finalText = finalText.slice(0, -1);
      }
      finalText += '...';
    }

    pdf.text(finalText, x, y);
  }
}