import { jsPDF } from 'jspdf';
import { GenerarPlanosRequest, PlanoConfig } from '@/types/planos';
import { DatosProcesados } from '@/lib/services/PlanoDataProcessor';
import { calculateInteriorAngles, toDMS } from '@/lib/geometry/utmUtils';
import { CADDrawing } from '@/lib/geometry/cadDrawing';

/**
 * Generador de Memoria Descriptiva - Proyecto Terra Lima
 * Genera un documento técnico legal basado en la data estructurada.
 */
export class MemoriaDescriptivaGenerator {
  private request: GenerarPlanosRequest;
  private config: PlanoConfig;
  // Datos ya procesados (prioridad registral + ángulos internos) — la misma
  // fuente que usa el Plano Perimétrico para su "CUADRO DE DATOS TÉCNICOS",
  // así ambos documentos del expediente muestran exactamente los mismos
  // valores de distancia y ángulo por lado (evita inconsistencias entre
  // folios de un mismo trámite).
  private datosProcesados: DatosProcesados;

  // Constantes de diseño
  private readonly MARGIN = 25;
  private readonly LINE_HEIGHT = 6;
  private readonly SECTION_GAP = 10;
  private readonly COLOR_PRIMARY = [50, 50, 50]; // Gris oscuro corporativo

  constructor(request: GenerarPlanosRequest, config: PlanoConfig, datosProcesados: DatosProcesados) {
    this.request = request;
    this.config = config;
    this.datosProcesados = datosProcesados;
  }

  async generate(pdf: jsPDF): Promise<void> {
    const { lote, dimensiones, colindancias, propietario, vertices } = this.request;
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    
    // --- PÁGINA 1 ---
    
    // 1. Encabezado
    await this.drawHeader(pdf, lote);
    
    let y = 70; // Posición inicial después del header

    // 2. Título del Documento
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.setTextColor(0, 0, 0);
    const title = 'MEMORIA DESCRIPTIVA';
    const titleWidth = pdf.getTextWidth(title);
    
    // Subrayado del título
    pdf.text(title, pageWidth / 2, y, { align: 'center' });
    pdf.setLineWidth(0.5);
    pdf.line(pageWidth/2 - titleWidth/2, y + 2, pageWidth/2 + titleWidth/2, y + 2);
    y += 20;

    // 3. SECCIONES (Iteramos lógica para manejo de saltos de página)
    
    // --- I. GENERALIDADES ---
    y = await this.checkPageBreak(pdf, y, pageHeight, lote);
    y = this.drawSectionTitle(pdf, 'I. GENERALIDADES', y);
    
    const generalText = `La presente Memoria Descriptiva tiene por objeto describir técnica y legalmente el lote de terreno urbano, delimitando sus linderos y medidas perimétricas, así como su ubicación y área, el cual forma parte del proyecto inmobiliario "TERRA LIMA".`;
    y = this.drawJustifiedText(pdf, generalText, y);
    y += this.SECTION_GAP;

    // --- II. IDENTIFICACIÓN Y UBICACIÓN ---
    y = await this.checkPageBreak(pdf, y, pageHeight, lote);
    y = this.drawSectionTitle(pdf, 'II. IDENTIFICACIÓN Y UBICACIÓN DEL PREDIO', y);

    const ubicacionData = [
      { label: 'PROYECTO', value: 'TERRA LIMA' },
      { label: 'ETAPA', value: lote.etapa || '---' },
      { label: 'MANZANA', value: lote.manzana },
      { label: 'LOTE', value: lote.numeroLote },
      { label: 'CÓDIGO INTERNO', value: lote.codigo },
      { label: 'DEPARTAMENTO', value: lote.ubicacion?.departamento || '---' },
      { label: 'PROVINCIA', value: lote.ubicacion?.provincia || '---' },
      { label: 'DISTRITO', value: lote.ubicacion?.distrito || '---' },
      { label: 'DIRECCIÓN', value: lote.ubicacion?.direccion || `Mz. ${lote.manzana} Lote ${lote.numeroLote}` },
    ];

    y = this.drawDataGrid(pdf, ubicacionData, y);
    y += this.SECTION_GAP;

    // --- III. LINDEROS Y MEDIDAS PERIMÉTRICAS ---
    y = await this.checkPageBreak(pdf, y, pageHeight, lote);
    y = this.drawSectionTitle(pdf, 'III. LINDEROS Y MEDIDAS PERIMÉTRICAS', y);

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text('El inmueble se encuentra delimitado de la siguiente manera:', this.MARGIN, y);
    y += this.LINE_HEIGHT * 1.5;

    // Iterar sobre las colindancias del JSON (Frente, Fondo, Derecha, Izquierda)
    for (const col of colindancias) {
      y = await this.checkPageBreak(pdf, y, pageHeight, lote);

      const lado = col.lado.toUpperCase(); // FRENTE, DERECHA, etc.

      // Construcción inteligente del texto legal
      let descripcion = '';
      const longitud = col.longitud ? col.longitud.toFixed(2) : '0.00';
      const nombre = col.nombre || '---';

      // Lógica de redacción según tipo
      if (col.tipo?.toLowerCase() === 'calle' || col.tipo?.toLowerCase() === 'via' || col.tipo?.toLowerCase() === 'av') {
        descripcion = `Por el ${lado}: Colinda con ${col.tipo} "${nombre}", con una línea recta de ${longitud} ml.`;
      } else {
        const propInfo = col.propietario ? `, propiedad de ${col.propietario}` : '';
        descripcion = `Por el ${lado}: Colinda con el ${col.tipo} "${nombre}"${propInfo}, con una línea recta de ${longitud} ml.`;
      }

      // Dibujar título del lado (Negrita)
      pdf.setFont('helvetica', 'bold');
      pdf.text(`POR EL ${lado}:`, this.MARGIN + 5, y);

      // Dibujar descripción (Normal) con indentación
      pdf.setFont('helvetica', 'normal');
      // Usamos splitTextToSize para manejar textos largos que necesiten wrap
      const lines = pdf.splitTextToSize(descripcion.split(':')[1].trim(), pageWidth - (this.MARGIN * 2) - 35);
      pdf.text(lines, this.MARGIN + 40, y);

      y += (lines.length * this.LINE_HEIGHT) + 2;
    }

    y += this.SECTION_GAP;

    // --- IV. ÁREA Y PERÍMETRO ---
    y = await this.checkPageBreak(pdf, y, pageHeight, lote);
    y = this.drawSectionTitle(pdf, 'IV. ÁREA Y PERÍMETRO', y);

    const areasData = [
      { label: 'ÁREA DEL TERRENO', value: `${dimensiones.area.toFixed(2)} m²`, bold: true },
      { label: 'PERÍMETRO TOTAL', value: `${dimensiones.perimetro.toFixed(2)} ml`, bold: true },
    ];
    y = this.drawDataGrid(pdf, areasData, y);
    y += this.SECTION_GAP;

    // --- V. COORDENADAS UTM (Cuadro Técnico) ---
    // Verificamos si cabe la tabla completa, sino salto de página
    const tableHeight = (vertices.length * 7) + 20;
    if (y + tableHeight > pageHeight - 50) {
      pdf.addPage();
      await this.drawHeader(pdf, lote);
      y = 70;
    }
    
    y = this.drawSectionTitle(pdf, 'V. COORDENADAS UTM (WGS-84)', y);
    y = this.drawCoordinatesTable(pdf, vertices, y);
    y += this.SECTION_GAP;

    // --- VI. PROPIETARIO ---
    if (propietario) {
      y = await this.checkPageBreak(pdf, y, pageHeight, lote);
      y = this.drawSectionTitle(pdf, 'VI. DEL PROPIETARIO', y);
      
      const propData = [
        { label: 'NOMBRE / RAZÓN SOCIAL', value: propietario.nombre },
        { label: 'DNI / RUC', value: propietario.ruc || propietario.dni || '---' },
      ];
      
      if (propietario.direccion) propData.push({ label: 'DOMICILIO', value: propietario.direccion });
      
      y = this.drawDataGrid(pdf, propData, y);
    }

    // --- PIE DE PÁGINA (FIRMAS) ---
    this.drawFooter(pdf, lote);
  }

  // ===========================================================================
  // MÉTODOS DE DIBUJO Y FORMATO
  // ===========================================================================

  private async drawHeader(pdf: jsPDF, lote: any): Promise<void> {
    const pageWidth = pdf.internal.pageSize.width;
    const [r, g, b] = this.COLOR_PRIMARY;

    // Marco superior
    pdf.setDrawColor(r, g, b);
    pdf.setLineWidth(0.8);
    pdf.rect(10, 10, pageWidth - 20, 45);

    // Línea separadora vertical
    const splitX = 70;
    pdf.setLineWidth(0.2);
    pdf.line(splitX, 10, splitX, 55);

    // LOGO: imagen real (contain-fit, sin deformación) con fallback a
    // logotipo de texto. Misma identidad visual que ya usan el Plano
    // Perimétrico y el Plano de Ubicación en su membrete — antes la Memoria
    // era el único de los 3 documentos del expediente que mostraba un
    // logotipo de texto en vez del logo real.
    const logoBoxX = 14;
    const logoBoxY = 13;
    const logoBoxW = splitX - logoBoxX - 4;
    const logoBoxH = 24;
    const logoCenterX = logoBoxX + logoBoxW / 2;
    let logoDrawn = false;

    if (this.config.logoUrl) {
      try {
        const res = await fetch(this.config.logoUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        const data = new Uint8Array(buffer);
        const contentType = res.headers.get('content-type') || '';
        const format = contentType.includes('png') ? 'PNG' : 'JPEG';
        new CADDrawing(pdf).drawImageContained(data, format, logoBoxX, logoBoxY, logoBoxW, logoBoxH);
        logoDrawn = true;
      } catch (err) {
        console.warn('Fallo al cargar logoUrl en Memoria Descriptiva:', err);
      }
    }

    if (!logoDrawn) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(18);
      pdf.setTextColor(r, g, b);
      pdf.text('TERRA', logoCenterX, 28, { align: 'center' });
      pdf.text('LIMA', logoCenterX, 36, { align: 'center' });
    }

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(r, g, b);
    pdf.text('Desarrollo Inmobiliario', logoCenterX, 42, { align: 'center' });

    // DATOS DEL DOCUMENTO (Lado Derecho)
    const dataX = splitX + 5;
    let dataY = 18;

    pdf.setFontSize(9);

    const headerData = [
      { l: 'PROYECTO:', v: 'TERRA LIMA' },
      { l: 'DOCUMENTO:', v: 'MEMORIA DESCRIPTIVA' },
      { l: 'CÓDIGO:', v: lote.codigo || '---' },
      { l: 'FECHA:', v: new Date().toLocaleDateString('es-PE', { year: 'numeric', month: 'long', day: 'numeric' }) }
    ];

    // Color fijado explícitamente en cada línea (no heredado de una llamada
    // anterior): label en el gris corporativo, valor en negro puro para
    // máximo contraste. Antes solo se fijaba una vez antes del forEach, lo
    // que dependía de que ninguna otra rutina hubiera cambiado el color del
    // canvas entretanto.
    headerData.forEach(item => {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(r, g, b);
      pdf.text(item.l, dataX, dataY);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(0, 0, 0);
      pdf.text(item.v, dataX + 30, dataY);
      dataY += 8;
    });
  }

  private drawSectionTitle(pdf: jsPDF, title: string, y: number): number {
    const pageWidth = pdf.internal.pageSize.width;
    
    pdf.setFillColor(240, 240, 240); // Gris muy claro
    pdf.rect(this.MARGIN, y, pageWidth - (this.MARGIN * 2), 8, 'F');
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, this.MARGIN + 5, y + 5.5);
    
    return y + 14;
  }

  private drawDataGrid(pdf: jsPDF, data: any[], y: number): number {
    pdf.setFontSize(10);
    const lineHeight = 7;
    
    data.forEach((item) => {
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${item.label}:`, this.MARGIN + 5, y);
      
      pdf.setFont('helvetica', item.bold ? 'bold' : 'normal');
      // Alineación de valores a la derecha o tabulados
      pdf.text(item.value, this.MARGIN + 60, y);
      
      y += lineHeight;
    });
    
    return y;
  }

  private drawJustifiedText(pdf: jsPDF, text: string, y: number): number {
    const pageWidth = pdf.internal.pageSize.width;
    const maxWidth = pageWidth - (this.MARGIN * 2);
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    
    const lines = pdf.splitTextToSize(text, maxWidth);
    pdf.text(lines, this.MARGIN, y);
    
    return y + (lines.length * 6);
  }

  private drawCoordinatesTable(pdf: jsPDF, vertices: number[][], y: number): number {
    const pageWidth = pdf.internal.pageSize.width;
    const tableWidth = pageWidth - (this.MARGIN * 2);
    const rowHeight = 7;

    // Anchos proporcionales al contenido de cada columna (suman tableWidth).
    // Orden solicitado: VÉRTICE, LADO, DIST., ÁNGULO INTERNO, ESTE (X), NORTE (Y).
    const colWidths = [18, 26, 22, 30, 32, 32].map((w) => (w / 160) * tableWidth);

    // Ángulos internos: misma fuente única de verdad que el Plano
    // Perimétrico (lib/geometry/utmUtils), robusta ante el sentido de
    // recorrido del polígono.
    const angulosInternos = calculateInteriorAngles(vertices as [number, number][]);

    // Distancias registrales por lado: misma fuente que el Plano
    // Perimétrico (datosProcesados.linderosFinal), indexadas por vértice.
    const linderoPorVertice = new Map(
      this.datosProcesados.linderosFinal.map((l) => [l.index, l]),
    );

    // Header
    pdf.setFillColor(50, 50, 50);
    pdf.rect(this.MARGIN, y, tableWidth, rowHeight, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);

    const headers = ['VÉRTICE', 'LADO', 'DIST.', 'ÁNG. INTERNO', 'ESTE (X)', 'NORTE (Y)'];
    let x = this.MARGIN;
    headers.forEach((h, i) => {
        pdf.text(h, x + colWidths[i] / 2, y + 5, { align: 'center' });
        x += colWidths[i];
    });

    y += rowHeight;
    pdf.setTextColor(0);

    // Rows
    vertices.forEach((v, i) => {
      const next = (i + 1) % vertices.length;
      const lindero = linderoPorVertice.get(i);

      if (i % 2 === 0) {
        pdf.setFillColor(245, 245, 245);
        pdf.rect(this.MARGIN, y, tableWidth, rowHeight, 'F');
      }

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      x = this.MARGIN;
      const values = [
        `V-${i + 1}`,
        lindero?.tramo ?? `V${i + 1}-V${next + 1}`,
        lindero ? `${lindero.longitudTexto}m` : '---',
        toDMS(angulosInternos[i]),
        v[0].toFixed(3),
        v[1].toFixed(3),
      ];
      values.forEach((val, j) => {
        pdf.text(val, x + colWidths[j] / 2, y + 5, { align: 'center' });
        x += colWidths[j];
      });

      y += rowHeight;
    });

    // Borde final
    pdf.setDrawColor(200);
    pdf.rect(this.MARGIN, y - (vertices.length * rowHeight), tableWidth, vertices.length * rowHeight);

    return y;
  }

  private drawFooter(pdf: jsPDF, lote: any): void {
    const pageWidth = pdf.internal.pageSize.width;
    const pageHeight = pdf.internal.pageSize.height;
    const footerY = pageHeight - 40;
    
    // Línea de firma
    const centerX = pageWidth / 2;
    
    pdf.setDrawColor(0);
    pdf.setLineWidth(0.5);
    pdf.line(centerX - 40, footerY, centerX + 40, footerY);
    
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'bold');
    pdf.text('PROFESIONAL RESPONSABLE', centerX, footerY + 5, { align: 'center' });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.text('Ingeniero Civil / Arquitecto', centerX, footerY + 10, { align: 'center' });
    
    // Hash de seguridad
    pdf.setFontSize(6);
    pdf.setTextColor(150);
    const id = `DOC-${lote.codigo}-${Date.now().toString(36).toUpperCase()}`;
    pdf.text(id, this.MARGIN, pageHeight - 10);
    
    // Numeración
    pdf.text(String(pdf.getCurrentPageInfo().pageNumber), pageWidth - this.MARGIN, pageHeight - 10, { align: 'right' });
  }

  private async checkPageBreak(pdf: jsPDF, currentY: number, pageHeight: number, lote: any): Promise<number> {
    if (currentY > pageHeight - 50) {
      pdf.addPage();
      await this.drawHeader(pdf, lote);
      return 70; // Nuevo Y inicial
    }
    return currentY;
  }
}