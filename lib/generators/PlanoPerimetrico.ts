import { jsPDF } from 'jspdf';
import { GenerarPlanosRequest, PlanoConfig, UTMCoordinate } from '@/types/planos';
import { CADDrawing } from '@/lib/geometry/cadDrawing';
import { utmToPaper, utmToPaperRelative, metrosAPapel } from '@/lib/geometry/scaleUtils';
import { calculateDistance, getBoundingBox, calculateCentroid } from '@/lib/geometry/utmUtils';
import { PLANO_THEME, getGridInterval } from '@/lib/config/PlanoTheme';

/**
 * Generador de Plano Perimétrico Profesional (Versión Refactorizada)
 *
 * CHANGELOG:
 * - Estilos desacoplados: Todos los valores visuales provienen de PlanoTheme.ts
 * - Sin magic numbers: Layout y dimensiones configurables centralmente
 * - Texto adaptativo: Implementa drawTextAutoFit para nombres largos
 * - Mantenimiento mejorado: Cambios de diseño sin tocar lógica
 *
 * FUNCIONALIDADES PRESERVADAS:
 * - Etiqueta Central: Muestra "A=..." y "P=..." explícitamente
 * - Croquis Ubicación: Factor de seguridad (0.85) para evitar desbordes
 * - Clipping: Garantiza limpieza visual
 * - Grilla UTM: Coordenadas reales con intervalos dinámicos
 * - Contexto vectorial e imágenes satelitales
 */
export class PlanoPerimetricoGenerator {
  private request: GenerarPlanosRequest;

  constructor(
    request: GenerarPlanosRequest,
    private config: PlanoConfig
  ) {
    this.request = request;
  }

  /**
   * Helper: Convierte color hexadecimal a componentes RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remover el # si está presente
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }

  async generate(pdf: jsPDF): Promise<void> {
    const { vertices, lote, dimensiones, contexto, imagenContexto, propietario } = this.request;
    const cad = new CADDrawing(pdf);

    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    // ========== 1. DEFINICIÓN DE LAYOUT (Distribución desde PLANO_THEME) ==========
    const { LAYOUT } = PLANO_THEME;
    const rightColumnWidth = LAYOUT.COLUMNA_DERECHA_ANCHO;
    const margin = LAYOUT.MARGENES.IZQUIERDO; // Asumimos márgenes simétricos
    const gap = LAYOUT.GAP;

    // Coordenada X de la Columna Derecha
    const colX = pageWidth - rightColumnWidth - margin;
    
    // Alturas de bloques derechos (desde el tema)
    const titleBarHeight = LAYOUT.ALTURAS.HEADER;
    const ubicacionHeight = LAYOUT.ALTURAS.UBICACION;
    const membreteHeight = LAYOUT.ALTURAS.MEMBRETE;
    
    // El cuadro técnico ocupa el espacio restante dinámicamente
    const cuadroTecnicoHeight = pageHeight - (margin * 2) - titleBarHeight - ubicacionHeight - membreteHeight - (gap * 3);

    // Definición de rectángulos (Áreas)
    const titleBarArea = { x: colX, y: margin, width: rightColumnWidth, height: titleBarHeight };
    const ubicacionArea = { x: colX, y: margin + titleBarHeight + gap, width: rightColumnWidth, height: ubicacionHeight };
    const technicalTableArea = { x: colX, y: ubicacionArea.y + ubicacionHeight + gap, width: rightColumnWidth, height: cuadroTecnicoHeight };
    const membreteArea = { x: colX, y: pageHeight - membreteHeight - margin, width: rightColumnWidth, height: membreteHeight };

    // Área de Dibujo Principal (Izquierda)
    const drawingArea = {
      x: margin,
      y: margin,
      width: colX - margin - gap,
      height: pageHeight - (margin * 2)
    };

    // ========== 2. MARCO GLOBAL ==========
    this.drawProfessionalBorder(pdf, pageWidth, pageHeight);

    // ========== 3. CÁLCULO DE ESCALA Y GEOMETRÍA ==========
    // Calculamos escala para que el lote entre en el área de dibujo con margen del tema
    const { escala, escalaTexto } = this.calculateScaleForViewport(
      vertices,
      drawingArea.width,
      drawingArea.height,
      LAYOUT.DIBUJO.MARGEN_INTERNO
    );
    const centerX = drawingArea.x + drawingArea.width / 2;
    const centerY = drawingArea.y + drawingArea.height / 2;

    // ========== 4. RENDERIZADO DEL CONTEXTO (FONDO) ==========
    const vecinos = contexto?.lotesVecinos || (contexto as any)?.elementos;
    let esFondoOscuro = false;

    // Prioridad 1: Contexto Vectorial (Vecinos de la base de datos)
    if (vecinos && vecinos.length > 0) {
      this.renderVectorialContext(pdf, cad, vecinos, vertices, escala, centerX, centerY);
    }
    // Prioridad 2: Imagen Satelital (si no hay vectores)
    else if (imagenContexto && imagenContexto.data) {
      this.renderImageContext(pdf, imagenContexto.data, drawingArea);
      esFondoOscuro = true;
    }

    // ========== 5. RENDERIZADO TÉCNICO (CAPA SUPERIOR) ==========
    
    // A. Grilla UTM (Coordenadas reales)
    this.drawRealUTMGrid(pdf, drawingArea, vertices, escala, centerX, centerY);

    // B. Lote Principal (Polígono grueso destacado)
    const paperPoints = utmToPaper(vertices, escala, centerX, centerY);
    cad.drawPolygon(paperPoints, {
      lineWidth: PLANO_THEME.STROKES.LOTE_BOUNDARY,
      strokeColor: PLANO_THEME.COLORS.PRIMARY,
      fillColor: vecinos?.length > 0 ? PLANO_THEME.COLORS.CONTEXT_FILL : undefined
    });

    // C. Etiqueta Central (Lote y Área) - CORREGIDO (Algoritmo Polo Inaccesibilidad + Texto Completo)
    this.drawPolygonCentralData(pdf, paperPoints, lote, dimensiones);

    // D. Datos Topográficos (Cotas, Vértices, Ángulos)
    const datosTopograficos = this.calculateTopographicData(vertices);
    this.drawVerticesAndAngles(pdf, paperPoints, datosTopograficos.angulos, cad);
    this.drawDimensions(pdf, paperPoints, vertices, esFondoOscuro);

    // E. Título Principal y Norte en el mapa grande
    this.drawTitle(pdf, drawingArea, 'PLANO PERIMÉTRICO');
    this.drawNorthCatastro(
      pdf,
      drawingArea.x + drawingArea.width - PLANO_THEME.NORTE.OFFSET_X,
      drawingArea.y + PLANO_THEME.NORTE.OFFSET_Y,
      PLANO_THEME.NORTE.SIZE
    );

    // ========== 6. COLUMNA DERECHA (Información) ==========
    
    // 1. Título Superior (Negro con detalles visuales)
    this.drawHeaderTitleBar(pdf, titleBarArea);

    // 2. Plano de Ubicación (MEJORADO: Escala precisa y Clipping)
    this.drawLocationPlan(pdf, ubicacionArea, vertices, vecinos || []);

    // 3. Cuadro Técnico de Coordenadas
    this.drawTechnicalTable(pdf, technicalTableArea, vertices, datosTopograficos);

    // 4. Membrete Profesional (Con líneas forzadas)
    this.drawProfessionalMembrete(pdf, membreteArea, lote, dimensiones, escalaTexto, propietario);
  }

  // ===========================================================================
  // MÉTODOS DE DIBUJO ESTRUCTURALES
  // ===========================================================================

  /**
   * Dibuja la barra de título superior estilo CAD (Fondo negro, letras blancas)
   */
  private drawHeaderTitleBar(pdf: jsPDF, area: any) {
    const { x, y, width, height } = area;
    
    // Fondo negro para alto contraste
    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, width, height, 'F');
    
    // División visual (70% Título / 30% Código)
    const splitX = x + (width * 0.70);

    // Título Principal
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H2);
    pdf.text('PLANO PERIMÉTRICO Y UBICACIÓN', x + (splitX - x)/2, y + height/2 + 4, { align: 'center' });

    // Línea separadora vertical blanca
    pdf.setDrawColor(255);
    pdf.setLineWidth(PLANO_THEME.STROKES.SEPARATOR);
    pdf.line(splitX, y, splitX, y + height);

    // --- SECCIÓN DERECHA: CÓDIGO DE LÁMINA CON LÍNEAS VISUALES ---
    // Fondo blanco para el código para que resalte más (Estilo sello)
    const codeAreaW = width - (splitX - x);
    pdf.setFillColor(255, 255, 255);
    // Un pequeño recuadro blanco dentro del área negra
    pdf.rect(splitX + 2, y + 2, codeAreaW - 4, height - 4, 'F');

    // Texto del código
    pdf.setTextColor(0); // Negro
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.text('LÁMINA Nº', splitX + 5, y + 5);
    
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H3);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('PP-01', splitX + codeAreaW/2 + 1, y + 9, {align: 'center'});
    
    // Línea decorativa debajo del PP-01 para dar énfasis
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    const lineW = 10;
    const lineX = splitX + codeAreaW/2 + 1 - lineW/2;
    pdf.line(lineX, y + 9.5, lineX + lineW, y + 9.5);
  }

  /**
   * Plano de Ubicación Inteligente
   * Asegura que el lote y contexto encajen perfectamente en el cuadro.
   * Usa factor de seguridad del tema y Clipping.
   */
  private drawLocationPlan(pdf: jsPDF, area: any, vertices: UTMCoordinate[], vecinos: any[]) {
    const { UBICACION } = PLANO_THEME;
    
    // 1. Marco y Header
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(area.x, area.y, area.width, area.height, 'FD');

    const headerH = UBICACION.HEADER_HEIGHT;
    const headerColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER);
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.rect(area.x, area.y, area.width, headerH, 'F');
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('CROQUIS DE UBICACIÓN (S/E)', area.x + area.width/2, area.y + 3.5, { align: 'center' });

    // --- ZONA DE DIBUJO CON CLIPPING ---
    const drawX = area.x + 0.5;
    const drawY = area.y + headerH + 0.5;
    const drawW = area.width - 1;
    const drawH = area.height - headerH - 1;

    // Guardar estado gráfico antes de recortar
    pdf.saveGraphicsState();
    
    // Aplicar Clipping Rect (Recorte) - NADA se dibujará fuera de esto
    pdf.rect(drawX, drawY, drawW, drawH, 'S'); 
    pdf.clip(); 

    // 2. Cálculo de Geometría (Lote + Contexto)
    let allPoints: UTMCoordinate[] = [...vertices];
    if (vecinos && vecinos.length > 0) {
      vecinos.forEach(v => {
        if(v.vertices) allPoints = allPoints.concat(v.vertices);
      });
    }

    const bbox = getBoundingBox(allPoints);
    
    // 3. Cálculo de Escala Robusto
    // Margen de seguridad del tema (previene que líneas gruesas toquen el borde)
    const marginFactor = UBICACION.MARGIN_FACTOR;
    
    // Dimensiones del contenido real en metros
    // Protección contra dimensiones cero
    const contentW = (bbox.maxX - bbox.minX) || 10; 
    const contentH = (bbox.maxY - bbox.minY) || 10;
    
    // Escala: Pixeles (del PDF) por Metro (del Terreno)
    const scaleX = (drawW * marginFactor) / contentW;
    const scaleY = (drawH * marginFactor) / contentH;
    
    // Usar la escala MENOR para que todo quepa (Fit All)
    const scale = Math.min(scaleX, scaleY);

    // 4. Centrado Geométrico
    // Centro del Bounding Box del contenido
    const bboxCX = (bbox.minX + bbox.maxX) / 2;
    const bboxCY = (bbox.minY + bbox.maxY) / 2;
    
    // Centro del área de dibujo en el PDF
    const pdfCX = drawX + (drawW / 2);
    const pdfCY = drawY + (drawH / 2);

    // Función de transformación
    const transform = (p: [number, number]) => {
      const dx = (p[0] - bboxCX) * scale;
      const dy = (p[1] - bboxCY) * scale;
      // Y invertido y centrado
      return [pdfCX + dx, pdfCY - dy] as [number, number];
    };

    // 5. Dibujo
    // Vecinos
    if (vecinos) {
      const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
      pdf.setDrawColor(grayVal);
      pdf.setLineWidth(UBICACION.VECINO_LINE_WIDTH);
      vecinos.forEach(vecino => {
        if (!vecino.vertices || vecino.vertices.length < 3) return;
        const pts = vecino.vertices.map(transform);
        pdf.lines(
          pts.map((p:any, i:number) => i === 0 ? p : [p[0] - pts[i-1][0], p[1] - pts[i-1][1]]), 
          pts[0][0], pts[0][1], [1, 1], 'S', true
        );
      });
    }

    // Lote Principal
    const lotePts = vertices.map(transform);
    pdf.setDrawColor(0);
    pdf.setLineWidth(UBICACION.LOTE_LINE_WIDTH);
    pdf.setFillColor(100, 100, 100);
    pdf.lines(
      lotePts.map((p, i) => i === 0 ? p : [p[0] - lotePts[i-1][0], p[1] - lotePts[i-1][1]]), 
      lotePts[0][0], lotePts[0][1], [1, 1], 'FD', true
    );

    // Restaurar estado gráfico (Quitar clipping) para seguir dibujando fuera
    pdf.restoreGraphicsState();

    // Norte Magnético pequeño (fuera del clip, superpuesto)
    this.drawNorthCatastro(pdf, area.x + area.width - 8, area.y + 15, UBICACION.NORTH_SIZE);
  }












  /**
   * Membrete Profesional Rediseñado
   */
  private drawProfessionalMembrete(pdf: jsPDF, area: any, lote: any, dimensiones: any, escala: string, prop: any) {
    const { x, y, width: w, height: h } = area;
    const { MEMBRETE } = PLANO_THEME;
    
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(x, y, w, h);

    // Layout desde el tema
    const colSplit = w * MEMBRETE.LOGO_COLUMN_PERCENT;
    pdf.line(x + colSplit, y, x + colSplit, y + h);

    // --- LOGO (Columna Izquierda) ---
    // Aquí puedes reemplazar con pdf.addImage() si tienes un logo real
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H1);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('LOGO', x + colSplit/2, y + h/2 - 2, { align: 'center' });
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text('EMPRESA / ING.', x + colSplit/2, y + h/2 + 4, { align: 'center' });
    
    // --- CAMPOS DE DATOS (Columna Derecha) ---
    const startX = x + colSplit + MEMBRETE.PADDING_H;
    const lineHeight = h / MEMBRETE.NUM_FILAS;

    // Función auxiliar para dibujar filas de datos con LÍNEAS VISIBLES
    const drawRow = (idx: number, label: string, val: string) => {
        const rowY = y + (idx * lineHeight);
        // Línea separadora (excepto la primera)
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
        // Usar drawTextAutoFit para valores largos
        this.drawTextAutoFit(pdf, val || '---', startX, rowY + 8, w - colSplit - MEMBRETE.PADDING_H * 2, PLANO_THEME.FONTS.SIZES.BODY);
    };

    drawRow(0, 'PROYECTO:', lote.nombre || 'LEVANTAMIENTO TOPOGRÁFICO');
    drawRow(1, 'PROPIETARIO:', prop?.nombre || '---');
    drawRow(2, 'UBICACIÓN:', `Mz. ${lote.manzana} Lt. ${lote.numeroLote} - ${lote.urbanizacion || ''}`);
    
    // Fila 4: Dividida en Área y Perímetro
    const rowY4 = y + (3 * lineHeight);
    const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
    pdf.setDrawColor(grayVal);
    pdf.line(x + colSplit, rowY4, x + w, rowY4);
    
    // Área (Con A=...)
    const dimmedVal = parseInt(PLANO_THEME.COLORS.DIMMED.slice(1, 3), 16);
    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text('ÁREA:', startX, rowY4 + 3.5);
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(`${dimensiones.area.toFixed(2)} m²`, startX, rowY4 + 8);

    // Perímetro (a la derecha) (Con P=...)
    const midX = startX + 30;
    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text('PERÍMETRO:', midX, rowY4 + 3.5);
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(`${dimensiones.perimetro.toFixed(2)} ml`, midX, rowY4 + 8);

    // Fila 5: Escala y Fecha
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







  



  /**
   * Cuadro Técnico de Coordenadas
   */
  private drawTechnicalTable(pdf: jsPDF, area: any, vertices: UTMCoordinate[], datos: any) {
    const { angulos, distancias } = datos;
    const { x, y: startY, width: w } = area;
    const { TABLA_TECNICA } = PLANO_THEME;
    let y = startY;

    // Header Tabla
    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, w, TABLA_TECNICA.HEADER_HEIGHT, 'F');
    pdf.setTextColor(255);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('CUADRO DE DATOS TÉCNICOS (WGS84)', x + w/2, y + 4, { align: 'center' });
    y += TABLA_TECNICA.HEADER_HEIGHT;

    // Sub-header columnas
    const cols = ['VERT.', 'LADO', 'DIST.', 'ANG.', 'ESTE (X)', 'NORTE (Y)'];
    // Distribución porcentual desde el tema
    const { COLUMNAS } = TABLA_TECNICA;
    const colW = [COLUMNAS.VERTICE, COLUMNAS.LADO, COLUMNAS.DISTANCIA, COLUMNAS.ANGULO, COLUMNAS.ESTE, COLUMNAS.NORTE]
      .map(p => (w * p) / 100);
    
    const headerColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER);
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.setDrawColor(0);
    pdf.rect(x, y, w, TABLA_TECNICA.SUBHEADER_HEIGHT, 'FD');
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

    let cx = x;
    cols.forEach((c, i) => {
        pdf.text(c, cx + colW[i]/2, y + 3.5, { align: 'center' });
        cx += colW[i];
    });
    y += TABLA_TECNICA.SUBHEADER_HEIGHT;

    // Filas de datos
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    vertices.forEach((v, i) => {
        const next = (i + 1) % vertices.length;
        // Alternar color de filas para legibilidad (Zebra striping)
        if (i % 2 === 0) {
          pdf.setFillColor(255, 255, 255);
        } else {
          const zebraColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_ZEBRA);
          pdf.setFillColor(zebraColor.r, zebraColor.g, zebraColor.b);
        }
        pdf.rect(x, y, w, TABLA_TECNICA.ROW_HEIGHT, 'FD');

        cx = x;
        const cellY = y + 3;
        
        const drawCell = (txt: string, w: number) => {
            pdf.text(txt, cx + w/2, cellY, { align: 'center' });
            cx += w;
        };

        drawCell(`V${i+1}`, colW[0]);
        drawCell(`V${i+1}-V${next+1}`, colW[1]);
        drawCell(distancias[i].toFixed(2), colW[2]);
        drawCell(angulos[i].toFixed(2) + '°', colW[3]);
        drawCell(v[0].toFixed(2), colW[4]);
        drawCell(v[1].toFixed(2), colW[5]);

        y += TABLA_TECNICA.ROW_HEIGHT;
    });
  }

  // ===========================================================================
  // MÉTODOS DE APOYO (Grillas, Contexto, Utiles)
  // ===========================================================================

  /**
   * Dibuja los datos centrales asegurando que estén DENTRO del polígono.
   * Utiliza el algoritmo "Polo de Inaccesibilidad" aproximado para encontrar el mejor punto.
   */
  private drawPolygonCentralData(pdf: jsPDF, pts: [number, number][], lote: any, dims: any) {
    const { ETIQUETA_CENTRAL } = PLANO_THEME;
    
    // 1. Encontrar el punto más "profundo" dentro del polígono
    const c = this.calculatePoleOfInaccessibility(pts);
    
    // Fondo blanco para que se lea sobre tramas o imágenes
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
    
    // Dibujamos el cuadro centrado en nuestro punto calculado
    pdf.rect(c.x - ETIQUETA_CENTRAL.WIDTH/2, c.y - ETIQUETA_CENTRAL.HEIGHT/2,
             ETIQUETA_CENTRAL.WIDTH, ETIQUETA_CENTRAL.HEIGHT, 'FD');
    
    // Línea 1: Lote
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setTextColor(0);
    pdf.text(`LOTE ${lote.numeroLote}`, c.x, c.y - 2, { align: 'center' });
    
    // Línea 2: Área (A=...)
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text(`A = ${dims.area.toFixed(2)} m²`, c.x, c.y + 1, { align: 'center' });

    // Línea 3: Perímetro (P=...)
    pdf.text(`P = ${dims.perimetro.toFixed(2)} ml`, c.x, c.y + ETIQUETA_CENTRAL.LINE_SPACING, { align: 'center' });
  }

  /**
   * Calcula el "Polo de Inaccesibilidad" (Punto visual interior óptimo).
   * Aproximación mediante una cuadrícula de prueba sobre el Bounding Box.
   * Esto funciona mucho mejor que el Centroide para formas de "L", "U" o "C".
   */
  private calculatePoleOfInaccessibility(pts: [number, number][]): {x: number, y: number} {
    // 1. Obtener Bounding Box
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
        if(p[0] < minX) minX = p[0];
        if(p[0] > maxX) maxX = p[0];
        if(p[1] < minY) minY = p[1];
        if(p[1] > maxY) maxY = p[1];
    });

    const width = maxX - minX;
    const height = maxY - minY;
    
    // Configuración de la cuadrícula de búsqueda
    // A mayor resolución (cellSize menor), más preciso pero más lento.
    // Usamos una cuadrícula de 10x10 como compromiso inicial.
    const cellSize = Math.min(width, height) / 10;
    
    let bestPoint = { x: (minX + maxX)/2, y: (minY + maxY)/2 };
    let maxDist = 0;

    // Si el centroide simple está dentro, es nuestro candidato inicial
    const centroid = this.calculateVisualCenter(pts);
    if(this.isPointInPolygon(centroid, pts)) {
        bestPoint = centroid;
        maxDist = this.getDistToClosestEdge(centroid, pts);
    }

    // Escanear cuadrícula
    for (let x = minX; x <= maxX; x += cellSize) {
        for (let y = minY; y <= maxY; y += cellSize) {
            const p = { x, y };
            if (this.isPointInPolygon(p, pts)) {
                const dist = this.getDistToClosestEdge(p, pts);
                if (dist > maxDist) {
                    maxDist = dist;
                    bestPoint = p;
                }
            }
        }
    }

    return bestPoint;
  }

  /** Distancia de un punto al borde más cercano del polígono */
  private getDistToClosestEdge(p: {x:number, y:number}, pts: [number, number][]): number {
      let minDist = Infinity;
      for (let i = 0; i < pts.length; i++) {
          const p1 = pts[i];
          const p2 = pts[(i + 1) % pts.length];
          const dist = this.distToSegment(p, p1, p2);
          if (dist < minDist) minDist = dist;
      }
      return minDist;
  }

  /** Distancia de punto P al segmento AB */
  private distToSegment(p: {x:number, y:number}, a: [number, number], b: [number, number]): number {
      const x = p.x, y = p.y;
      const x1 = a[0], y1 = a[1];
      const x2 = b[0], y2 = b[1];

      const A = x - x1;
      const B = y - y1;
      const C = x2 - x1;
      const D = y2 - y1;

      const dot = A * C + B * D;
      const len_sq = C * C + D * D;
      let param = -1;
      if (len_sq !== 0) param = dot / len_sq;

      let xx, yy;

      if (param < 0) {
        xx = x1; yy = y1;
      } else if (param > 1) {
        xx = x2; yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }

      const dx = x - xx;
      const dy = y - yy;
      return Math.sqrt(dx * dx + dy * dy);
  }

  /** Función auxiliar: Point in Polygon (Ray Casting algorithm) */
  private isPointInPolygon(p: {x:number, y:number}, vertices: [number, number][]): boolean {
      let inside = false;
      for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
          const xi = vertices[i][0], yi = vertices[i][1];
          const xj = vertices[j][0], yj = vertices[j][1];
          
          const intersect = ((yi > p.y) !== (yj > p.y))
              && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
      }
      return inside;
  }

  private drawRealUTMGrid(pdf: jsPDF, area: any, vertices: UTMCoordinate[], escala: number, cx: number, cy: number) {
    const centroUtm = calculateCentroid(vertices);
    const interval = getGridInterval(escala); // Intervalo dinámico desde el tema

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
        // Texto rotado en el borde inferior
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
    
    // Marco exterior del área de dibujo
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(area.x, area.y, area.width, area.height);
  }

  private renderVectorialContext(pdf: jsPDF, cad: CADDrawing, vecinos: any[], mainVertices: UTMCoordinate[], escala: number, cx: number, cy: number) {
    const centroUtm = calculateCentroid(mainVertices);
    
    vecinos.forEach(vecino => {
        if(!vecino.vertices || vecino.vertices.length < 3) return;
        
        const pts = utmToPaperRelative(vecino.vertices, centroUtm, escala, cx, cy);
        
        // Dibujamos el vecino
        cad.drawPolygon(pts, {
            strokeColor: PLANO_THEME.COLORS.NEIGHBOR_STROKE,
            lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
            fillColor: PLANO_THEME.COLORS.NEIGHBOR_FILL
        });
        
        // Texto del lote vecino (si existe)
        const center = this.calculateVisualCenter(pts);
        if(!isNaN(center.x)) {
            const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
            pdf.setTextColor(grayVal);
            pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
            pdf.text(vecino.texto || '', center.x, center.y, { align: 'center'});
        }
    });
  }

  private calculateScaleForViewport(vertices: UTMCoordinate[], w: number, h: number, m: number) {
    const bbox = getBoundingBox(vertices);
    const scaleX = (bbox.width * 1000) / (w - m*2);
    const scaleY = (bbox.height * 1000) / (h - m*2);
    const raw = Math.max(scaleX, scaleY);
    // Escalas normalizadas estándar
    const scales = [50, 75, 100, 125, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000];
    const final = scales.find(s => s >= raw) || Math.ceil(raw/100)*100;
    return { escala: final, escalaTexto: `1/${final}` };
  }

  private drawProfessionalBorder(pdf: jsPDF, w: number, h: number) {
    const { MARCO, MARGENES } = PLANO_THEME.LAYOUT;
    
    pdf.setDrawColor(0);
    // Marco externo grueso
    pdf.setLineWidth(MARCO.EXTERNO_WIDTH);
    pdf.rect(MARCO.EXTERNO_OFFSET, MARCO.EXTERNO_OFFSET,
             w - MARCO.EXTERNO_OFFSET * 2, h - MARCO.EXTERNO_OFFSET * 2);
    
    // Marco interno fino
    pdf.setLineWidth(MARCO.INTERNO_WIDTH);
    pdf.rect(MARCO.INTERNO_OFFSET, MARCO.INTERNO_OFFSET,
             w - MARCO.INTERNO_OFFSET * 2, h - MARCO.INTERNO_OFFSET * 2);
  }

  private calculateVisualCenter(pts: [number, number][]): {x: number, y: number} {
      let sx=0, sy=0;
      pts.forEach(p => { sx+=p[0]; sy+=p[1]; });
      return { x: sx/pts.length, y: sy/pts.length };
  }
  
  private drawTitle(pdf: jsPDF, area: any, title: string) {
    const { TITULO } = PLANO_THEME;
    
    const centerX = area.x + area.width / 2;
    const titleY = area.y + area.height - TITULO.OFFSET_BOTTOM;
    
    // Fondo blanco para máscara (cubrir líneas de grilla)
    pdf.setFillColor(255, 255, 255);
    const fontSize = PLANO_THEME.FONTS.SIZES.H1;
    const titleWidth = pdf.getStringUnitWidth(title) * fontSize / pdf.internal.scaleFactor;
    pdf.rect(centerX - titleWidth/2 - TITULO.PADDING_H, titleY - TITULO.PADDING_V,
             titleWidth + TITULO.PADDING_H * 2, TITULO.BOX_HEIGHT, 'F');
    
    // Texto del título
    pdf.setFontSize(fontSize);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, centerX, titleY, { align: 'center' });
  }
  
  private drawNorthCatastro(pdf: jsPDF, x: number, y: number, s: number) {
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.NORTH_ARROW);
    
    // Aguja (Rombo alargado)
    // Parte negra (Norte)
    pdf.setFillColor(0, 0, 0);
    pdf.triangle(x, y - s/2, x - s/6, y, x + s/6, y, 'F');
    // Parte blanca (Sur)
    pdf.setFillColor(255, 255, 255);
    pdf.triangle(x, y + s/2, x - s/6, y, x + s/6, y, 'FD'); // Relleno blanco con borde
    
    // Línea central
    pdf.line(x, y - s/2, x, y + s/2);
    
    // Letra N
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(s); // Tamaño proporcional al símbolo
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text('N', x, y - s/2 - 2, { align: 'center' });
  }

  private calculateTopographicData(vertices: UTMCoordinate[]) {
    // Implementación básica para generar datos si no vienen pre-calculados
    const angulos = vertices.map(() => 90); // Placeholder: Debería ser cálculo real de azimut
    const distancias = vertices.map((v: UTMCoordinate, i:number) => {
        const next = vertices[(i+1)%vertices.length];
        return calculateDistance(v, next);
    });
    return { angulos, distancias };
  }

  private drawVerticesAndAngles(pdf: jsPDF, pts: [number, number][], angs: number[], cad: CADDrawing) {
    pts.forEach((p: [number, number], i:number) => {
        cad.drawCircle(p[0], p[1], 0.8, { fillColor: PLANO_THEME.COLORS.WHITE });
        pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
        pdf.text(`V${i+1}`, p[0]+2, p[1]-2);
    });
  }

  private drawDimensions(pdf: jsPDF, pts: [number, number][], utm: UTMCoordinate[], darkBg: boolean) {
    pts.forEach((p: [number, number], i:number) => {
        const next = pts[(i+1)%pts.length];
        const mx = (p[0]+next[0])/2;
        const my = (p[1]+next[1])/2;
        const dist = calculateDistance(utm[i], utm[(i+1)%utm.length]);
        
        pdf.setFillColor(255, 255, 255);
        // Si hay fondo oscuro (satélite), ponemos cajita blanca
        if(darkBg) pdf.rect(mx-4, my-2, 8, 4, 'F');
        
        pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
        pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
        pdf.text(`${dist.toFixed(2)}m`, mx, my+1, { align: 'center' });
    });
  }

  private renderImageContext(pdf: jsPDF, img: string, area: any) {
     try {
       pdf.addImage(img, 'PNG', area.x, area.y, area.width, area.height);
       // Capa blanca semitransparente para bajarle intensidad a la imagen satelital
       pdf.saveGraphicsState();
       pdf.setGState(new (pdf as any).GState({ opacity: 0.3 }));
       pdf.setFillColor(255, 255, 255);
       pdf.rect(area.x, area.y, area.width, area.height, 'F');
       pdf.restoreGraphicsState();
     } catch(e) {
       console.warn("Error renderizando imagen de contexto", e);
     }
  }

  // ===========================================================================
  // MÉTODO HELPER: TEXTO ADAPTATIVO
  // ===========================================================================

  /**
   * Ajusta el tamaño de la fuente automáticamente para que el texto quepa en el ancho dado.
   * Evita que nombres largos de propietarios se corten en el membrete.
   *
   * @param pdf - Instancia de jsPDF
   * @param text - Texto a dibujar
   * @param x - Coordenada X
   * @param y - Coordenada Y
   * @param maxWidth - Ancho máximo disponible (en mm)
   * @param initialSize - Tamaño inicial de fuente (por defecto BODY del tema)
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
    const minSize = PLANO_THEME.FONTS.SIZES.TINY; // No reducir más allá de TINY
    
    // Establecer fuente bold para el valor
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(currentSize);
    
    // Mientras el texto sea más ancho que el espacio disponible, reducir fuente
    while (pdf.getStringUnitWidth(text) * currentSize / pdf.internal.scaleFactor > maxWidth && currentSize > minSize) {
      currentSize -= 0.5;
      pdf.setFontSize(currentSize);
    }
    
    // Si aún así no cabe, truncar con elipsis
    let finalText = text;
    const textWidth = pdf.getStringUnitWidth(text) * currentSize / pdf.internal.scaleFactor;
    if (textWidth > maxWidth) {
      // Truncar caracteres hasta que quepa con "..."
      while (pdf.getStringUnitWidth(finalText + '...') * currentSize / pdf.internal.scaleFactor > maxWidth && finalText.length > 0) {
        finalText = finalText.slice(0, -1);
      }
      finalText += '...';
    }
    
    pdf.text(finalText, x, y);
  }
}
