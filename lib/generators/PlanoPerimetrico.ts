import { jsPDF } from 'jspdf';
import { GenerarPlanosRequest, PlanoConfig, UTMCoordinate } from '@/types/planos';
import { CADDrawing } from '@/lib/geometry/cadDrawing';
import { utmToPaper, utmToPaperRelative, metrosAPapel } from '@/lib/geometry/scaleUtils';
import { calculateDistance, getBoundingBox, calculateCentroid } from '@/lib/geometry/utmUtils';

/**
 * Generador de Plano Perimétrico Profesional (Versión Final Estándar Registral)
 * Correcciones Finales:
 * - Etiqueta Central: Muestra "A=..." y "P=..." explícitamente.
 * - Croquis Ubicación: Factor de seguridad aumentado (0.85) para evitar desbordes.
 * - Clipping: Se mantiene para garantizar limpieza visual.
 */
export class PlanoPerimetricoGenerator {
  private request: GenerarPlanosRequest;

  // Constantes de estilo CAD para consistencia profesional
  private readonly STYLE = {
    LINE_THICK: 0.6,    // Límite de propiedad (0.6mm)
    LINE_MEDIUM: 0.3,   // Marcos y textos principales (0.3mm)
    LINE_THIN: 0.1,     // Grillas, cotas y líneas auxiliares (0.1mm)
    COLOR_BLACK: '#000000',
    COLOR_GRAY: '#505050',
    COLOR_LIGHT_GRAY: '#E0E0E0'
  };

  constructor(
    request: GenerarPlanosRequest,
    private config: PlanoConfig
  ) {
    this.request = request;
  }

  async generate(pdf: jsPDF): Promise<void> {
    const { vertices, lote, dimensiones, contexto, imagenContexto, propietario } = this.request;
    const cad = new CADDrawing(pdf);

    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;

    // ========== 1. DEFINICIÓN DE LAYOUT (Distrbución A4/A3) ==========
    const rightColumnWidth = 100; // Ancho columna derecha (mm)
    const margin = 10;
    const gap = 5;

    // Coordenada X de la Columna Derecha
    const colX = pageWidth - rightColumnWidth - margin;
    
    // Alturas de bloques derechos
    const titleBarHeight = 12; // Barra negra superior
    const ubicacionHeight = 85; // Cuadro de ubicación generoso
    const membreteHeight = 55;  // Membrete compacto y técnico
    
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
    // Calculamos escala para que el lote entre en el área de dibujo con un margen de 20mm
    const { escala, escalaTexto } = this.calculateScaleForViewport(vertices, drawingArea.width, drawingArea.height, 20);
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
      lineWidth: this.STYLE.LINE_THICK,
      strokeColor: this.STYLE.COLOR_BLACK,
      fillColor: vecinos?.length > 0 ? '#F5F5F5' : undefined // Relleno sutil si hay contexto vectorial
    });

    // C. Etiqueta Central (Lote y Área) - CORREGIDO (Algoritmo Polo Inaccesibilidad + Texto Completo)
    this.drawPolygonCentralData(pdf, paperPoints, lote, dimensiones);

    // D. Datos Topográficos (Cotas, Vértices, Ángulos)
    const datosTopograficos = this.calculateTopographicData(vertices);
    this.drawVerticesAndAngles(pdf, paperPoints, datosTopograficos.angulos, cad);
    this.drawDimensions(pdf, paperPoints, vertices, esFondoOscuro);

    // E. Título Principal y Norte en el mapa grande
    this.drawTitle(pdf, drawingArea, 'PLANO PERIMÉTRICO');
    this.drawNorthCatastro(pdf, drawingArea.x + drawingArea.width - 25, drawingArea.y + 35, 20);

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

  /** * Dibuja la barra de título superior estilo CAD (Fondo negro, letras blancas)
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
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.text('PLANO PERIMÉTRICO Y UBICACIÓN', x + (splitX - x)/2, y + height/2 + 1.5, { align: 'center' });

    // Línea separadora vertical blanca
    pdf.setDrawColor(255);
    pdf.setLineWidth(0.5);
    pdf.line(splitX, y, splitX, y + height);

    // --- SECCIÓN DERECHA: CÓDIGO DE LÁMINA CON LÍNEAS VISUALES ---
    // Fondo blanco para el código para que resalte más (Estilo sello)
    const codeAreaW = width - (splitX - x);
    pdf.setFillColor(255, 255, 255);
    // Un pequeño recuadro blanco dentro del área negra
    pdf.rect(splitX + 2, y + 2, codeAreaW - 4, height - 4, 'F');

    // Texto del código
    pdf.setTextColor(0); // Negro
    pdf.setFontSize(6);
    pdf.text('LÁMINA Nº', splitX + 5, y + 5);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PP-01', splitX + codeAreaW/2 + 1, y + 9, {align: 'center'});
    
    // Línea decorativa debajo del PP-01 para dar énfasis
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.3);
    const lineW = 10;
    const lineX = splitX + codeAreaW/2 + 1 - lineW/2;
    pdf.line(lineX, y + 9.5, lineX + lineW, y + 9.5);
  }

  /** * Plano de Ubicación Inteligente (CORREGIDO: ESCALADO AGRESIVO)
   * Asegura que el lote y contexto encajen perfectamente en el cuadro.
   * Usa factor de seguridad 0.85 y Clipping.
   */
  private drawLocationPlan(pdf: jsPDF, area: any, vertices: UTMCoordinate[], vecinos: any[]) {
    // 1. Marco y Header
    pdf.setDrawColor(0);
    pdf.setLineWidth(this.STYLE.LINE_MEDIUM);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(area.x, area.y, area.width, area.height, 'FD');

    const headerH = 5;
    pdf.setFillColor(230, 230, 230);
    pdf.rect(area.x, area.y, area.width, headerH, 'F');
    pdf.setTextColor(0);
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'bold');
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
    // Margen de seguridad aumentado (0.85 = 15% de margen libre)
    // Esto previene que líneas gruesas toquen el borde
    const marginFactor = 0.85; 
    
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
      pdf.setDrawColor(150);
      pdf.setLineWidth(0.1);
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
    pdf.setLineWidth(0.3);
    pdf.setFillColor(100, 100, 100);
    pdf.lines(
      lotePts.map((p, i) => i === 0 ? p : [p[0] - lotePts[i-1][0], p[1] - lotePts[i-1][1]]), 
      lotePts[0][0], lotePts[0][1], [1, 1], 'FD', true
    );

    // Restaurar estado gráfico (Quitar clipping) para seguir dibujando fuera
    pdf.restoreGraphicsState();

    // Norte Magnético pequeño (fuera del clip, superpuesto)
    this.drawNorthCatastro(pdf, area.x + area.width - 8, area.y + 15, 8);
  }

  /**
   * Membrete Profesional Rediseñado
   */
  private drawProfessionalMembrete(pdf: jsPDF, area: any, lote: any, dimensiones: any, escala: string, prop: any) {
    const { x, y, width: w, height: h } = area;
    
    pdf.setDrawColor(0);
    pdf.setLineWidth(this.STYLE.LINE_MEDIUM);
    pdf.rect(x, y, w, h);

    // Layout: 
    // Izquierda (35%): Logo
    // Derecha (65%): Campos de información
    const colSplit = w * 0.35;
    pdf.line(x + colSplit, y, x + colSplit, y + h);

    // --- LOGO (Columna Izquierda) ---
    // Aquí puedes reemplazar con pdf.addImage() si tienes un logo real
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('LOGO', x + colSplit/2, y + h/2 - 2, { align: 'center' });
    pdf.setFontSize(7);
    pdf.setFont('helvetica', 'normal');
    pdf.text('EMPRESA / ING.', x + colSplit/2, y + h/2 + 4, { align: 'center' });
    
    // --- CAMPOS DE DATOS (Columna Derecha) ---
    const startX = x + colSplit + 3;
    const lineHeight = h / 5; // Dividimos en 5 filas iguales

    // Función auxiliar para dibujar filas de datos con LÍNEAS VISIBLES
    const drawRow = (idx: number, label: string, val: string) => {
        const rowY = y + (idx * lineHeight);
        // Línea separadora (excepto la primera)
        if (idx > 0) {
            pdf.setDrawColor(150); // Gris visible para las líneas internas
            pdf.setLineWidth(0.1);
            pdf.line(x + colSplit, rowY, x + w, rowY);
        }
        
        pdf.setTextColor(80); // Etiqueta gris oscuro
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'normal');
        pdf.text(label, startX, rowY + 3.5);
        
        pdf.setTextColor(0); // Valor negro puro
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'bold');
        // Truncar texto largo para que no se salga
        const cleanVal = (val || '').length > 32 ? (val || '').substring(0,30) + '...' : (val || '');
        pdf.text(cleanVal, startX, rowY + 8);
    };

    drawRow(0, 'PROYECTO:', lote.nombre || 'LEVANTAMIENTO TOPOGRÁFICO');
    drawRow(1, 'PROPIETARIO:', prop?.nombre || '---');
    drawRow(2, 'UBICACIÓN:', `Mz. ${lote.manzana} Lt. ${lote.numeroLote} - ${lote.urbanizacion || ''}`);
    
    // Fila 4: Dividida en Área y Perímetro
    const rowY4 = y + (3 * lineHeight);
    pdf.setDrawColor(150);
    pdf.line(x + colSplit, rowY4, x + w, rowY4);
    
    // Área (Con A=...)
    pdf.setTextColor(80); pdf.setFontSize(6); pdf.setFont('helvetica', 'normal');
    pdf.text('ÁREA:', startX, rowY4 + 3.5);
    pdf.setTextColor(0); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
    pdf.text(`${dimensiones.area.toFixed(2)} m²`, startX, rowY4 + 8);

    // Perímetro (a la derecha) (Con P=...)
    const midX = startX + 30;
    pdf.setTextColor(80); pdf.setFontSize(6); pdf.setFont('helvetica', 'normal');
    pdf.text('PERÍMETRO:', midX, rowY4 + 3.5);
    pdf.setTextColor(0); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
    pdf.text(`${dimensiones.perimetro.toFixed(2)} ml`, midX, rowY4 + 8);

    // Fila 5: Escala y Fecha
    const rowY5 = y + (4 * lineHeight);
    pdf.setDrawColor(150);
    pdf.line(x + colSplit, rowY5, x + w, rowY5);
    
    pdf.setTextColor(80); pdf.setFontSize(6); pdf.setFont('helvetica', 'normal');
    pdf.text('ESCALA:', startX, rowY5 + 3.5);
    pdf.text('FECHA:', midX, rowY5 + 3.5);
    
    pdf.setTextColor(0); pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
    pdf.text(escala, startX, rowY5 + 8);
    pdf.text(new Date().toLocaleDateString(), midX, rowY5 + 8);
  }

  /**
   * Cuadro Técnico de Coordenadas
   */
  private drawTechnicalTable(pdf: jsPDF, area: any, vertices: UTMCoordinate[], datos: any) {
    const { angulos, distancias } = datos;
    const { x, y: startY, width: w } = area;
    let y = startY;

    // Header Tabla
    pdf.setFillColor(0, 0, 0); // Negro
    pdf.rect(x, y, w, 6, 'F');
    pdf.setTextColor(255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('CUADRO DE DATOS TÉCNICOS (WGS84)', x + w/2, y + 4, { align: 'center' });
    y += 6;

    // Sub-header columnas
    const cols = ['VERT.', 'LADO', 'DIST.', 'ANG.', 'ESTE (X)', 'NORTE (Y)'];
    // Distribución porcentual aproximada del ancho
    const colW = [10, 15, 15, 15, 22.5, 22.5].map(p => (w * p) / 100);
    
    pdf.setFillColor(230, 230, 230); // Gris claro
    pdf.setDrawColor(0);
    pdf.rect(x, y, w, 5, 'FD');
    pdf.setTextColor(0);
    pdf.setFontSize(6);

    let cx = x;
    cols.forEach((c, i) => {
        pdf.text(c, cx + colW[i]/2, y + 3.5, { align: 'center' });
        cx += colW[i];
    });
    y += 5;

    // Filas de datos
    pdf.setFont('helvetica', 'normal');
    vertices.forEach((v, i) => {
        const next = (i + 1) % vertices.length;
        // Alternar color de filas para legibilidad (Zebra striping)
        if (i % 2 === 0) pdf.setFillColor(255, 255, 255); else pdf.setFillColor(248, 248, 248);
        pdf.rect(x, y, w, 4.5, 'FD');

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

        y += 4.5;
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
    // 1. Encontrar el punto más "profundo" dentro del polígono
    const c = this.calculatePoleOfInaccessibility(pts);
    
    // Fondo blanco para que se lea sobre tramas o imágenes
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.1);
    
    const labelW = 28; // Un poco más ancho para que quepa "Perímetro..."
    const labelH = 10; // Un poco más alto para 3 líneas de texto (Lote, Area, Perim)
    
    // Dibujamos el cuadro centrado en nuestro punto calculado
    pdf.rect(c.x - labelW/2, c.y - labelH/2, labelW, labelH, 'FD');
    
    // Línea 1: Lote
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
    pdf.text(`LOTE ${lote.numeroLote}`, c.x, c.y - 2, { align: 'center' });
    
    // Línea 2: Área (A=...)
    pdf.setFontSize(6); pdf.setFont('helvetica', 'normal');
    pdf.text(`A = ${dims.area.toFixed(2)} m²`, c.x, c.y + 1, { align: 'center' });

    // Línea 3: Perímetro (P=...)
    pdf.text(`P = ${dims.perimetro.toFixed(2)} ml`, c.x, c.y + 3.5, { align: 'center' });
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
    const interval = escala >= 2000 ? 100 : (escala >= 500 ? 50 : 20); // Intervalo dinámico

    const viewWMeters = (area.width / 1000) * escala;
    const viewHMeters = (area.height / 1000) * escala;
    
    const minUtmX = centroUtm[0] - (viewWMeters / 2);
    const maxUtmX = centroUtm[0] + (viewWMeters / 2);
    const minUtmY = centroUtm[1] - (viewHMeters / 2);
    const maxUtmY = centroUtm[1] + (viewHMeters / 2);

    const startX = Math.ceil(minUtmX / interval) * interval;
    const startY = Math.ceil(minUtmY / interval) * interval;

    pdf.setLineWidth(this.STYLE.LINE_THIN); // Muy fina
    pdf.setDrawColor(150); // Gris
    pdf.setFontSize(6);
    pdf.setFont('helvetica', 'normal');

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
    pdf.setLineWidth(this.STYLE.LINE_MEDIUM);
    pdf.rect(area.x, area.y, area.width, area.height);
  }

  private renderVectorialContext(pdf: jsPDF, cad: CADDrawing, vecinos: any[], mainVertices: UTMCoordinate[], escala: number, cx: number, cy: number) {
    const centroUtm = calculateCentroid(mainVertices);
    
    vecinos.forEach(vecino => {
        if(!vecino.vertices || vecino.vertices.length < 3) return;
        
        const pts = utmToPaperRelative(vecino.vertices, centroUtm, escala, cx, cy);
        
        // Dibujamos el vecino
        cad.drawPolygon(pts, {
            strokeColor: '#AAAAAA',
            lineWidth: 0.1,
            fillColor: '#FCFCFC' // Casi blanco
        });
        
        // Texto del lote vecino (si existe)
        const center = this.calculateVisualCenter(pts);
        if(!isNaN(center.x)) {
            pdf.setTextColor(150);
            pdf.setFontSize(6);
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
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.8);
    pdf.rect(5, 5, w - 10, h - 10); // Marco externo grueso
    pdf.setLineWidth(0.2);
    pdf.rect(8, 8, w - 16, h - 16); // Marco interno fino
  }

  private calculateVisualCenter(pts: [number, number][]): {x: number, y: number} {
      let sx=0, sy=0;
      pts.forEach(p => { sx+=p[0]; sy+=p[1]; });
      return { x: sx/pts.length, y: sy/pts.length };
  }
  
  private drawTitle(pdf: jsPDF, area: any, title: string) {
    // Título sobre el mapa (opcional, estilo "Title Block" interno)
    const centerX = area.x + area.width / 2;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0);
    pdf.text(title, centerX, area.y - 4, { align: 'center' }); // Fuera del marco superior si hay espacio, o dentro
  }
  
  private drawNorthCatastro(pdf: jsPDF, x: number, y: number, s: number) {
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.4);
    pdf.line(x, y + s/2, x, y - s/2);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text('N', x, y - s/2 - 2, { align: 'center' });
    // Flecha norte estilizada
    pdf.triangle(x, y - s/2, x - 2, y - s/2 + 5, x + 2, y - s/2 + 5, 'F');
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
        cad.drawCircle(p[0], p[1], 0.8, { fillColor: '#FFF' });
        pdf.setFontSize(6);
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
        
        pdf.setFontSize(6);
        pdf.setFont('helvetica', 'bold');
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
}
