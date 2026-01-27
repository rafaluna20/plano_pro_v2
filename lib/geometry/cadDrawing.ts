    import { jsPDF } from 'jspdf';

/**
 * Clase auxiliar para dibujar primitivas CAD en PDF
 */
export class CADDrawing {
  constructor(private pdf: jsPDF) {}

  /**
   * Dibuja una línea con estilo CAD
   */
  drawLine(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    options?: {
      width?: number;
      color?: string;
      dashed?: boolean;
    }
  ): void {
    const {    width = 0.1, color = '#000000', dashed = false } = options || {};

    this.pdf.setLineWidth(width);
    this.pdf.setDrawColor(color);

    if (dashed) {
      // jsPDF puede no tener setLineDash en todas las versiones
      // Usar líneas discontinuas si está disponible
      if (typeof (this.pdf as any).setLineDash === 'function') {
        (this.pdf as any).setLineDash([2, 2], 0);
      }
    }

    this.pdf.line(x1, y1, x2, y2);

    if (dashed) {
      if (typeof (this.pdf as any).setLineDash === 'function') {
        (this.pdf as any).setLineDash([], 0); // Reset dash
      }
    }
  }

  /**
   * Dibuja un polígono completamente cerrado
   */
  drawPolygon(
    points: Array<[number, number]>,
    options?: {
      lineWidth?: number;
      strokeColor?: string;
      fillColor?: string;
      dashed?: boolean;
    }
  ): void {
    const {
      lineWidth = 0.2,  
      strokeColor = '#000000',
      fillColor,
      dashed = false
    } = options || {};

    this.pdf.setLineWidth(lineWidth);
    this.pdf.setDrawColor(strokeColor);

    if (fillColor) {
      this.pdf.setFillColor(fillColor);
    }

    if (dashed) {
      if (typeof (this.pdf as any).setLineDash === 'function') {
        (this.pdf as any).setLineDash([2, 2], 0);
      }
    }

    // Asegurar que el polígono se cierre conectando el último punto con el primero
    const closedPoints = [...points, points[0]];
    
    // Dibujar todas las líneas del polígono
    this.pdf.lines(
      closedPoints.slice(1).map(([x, y], i) => {
        const prev = closedPoints[i];
        return [x - prev[0], y - prev[1]];
      }),
      closedPoints[0][0],
      closedPoints[0][1],
      undefined,
      fillColor ? 'FD' : 'S' // Fill and Draw o Solo Draw
    );

    if (dashed) {
      if (typeof (this.pdf as any).setLineDash === 'function') {
        (this.pdf as any).setLineDash([], 0);
      }
    }
  }

  /**
   * Dibuja una cota (dimensión) profesional estilo CAD
   */
  drawDimension(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    text: string,
    offset: number = 5,
    options?: {
      fontSize?: number;
      arrowSize?: number;
    }
  ): void {
    const { fontSize = 8, arrowSize = 1.5 } = options || {};

    // Calcular vector perpendicular
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const perpX = -dy / length;
    const perpY = dx / length;

    // Puntos de la línea de cota (offset)
    const ox1 = x1 + perpX * offset;
    const oy1 = y1 + perpY * offset;
    const ox2 = x2 + perpX * offset;
    const oy2 = y2 + perpY * offset;

    // Dibujar líneas de extensión (más largas y profesionales)
    const extensionLength = Math.abs(offset) + 3;
    const ex1 = x1 + perpX * extensionLength;
    const ey1 = y1 + perpY * extensionLength;
    const ex2 = x2 + perpX * extensionLength;
    const ey2 = y2 + perpY * extensionLength;
    
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.setLineWidth(0.2);
    this.pdf.line(x1, y1, ex1, ey1);
    this.pdf.line(x2, y2, ex2, ey2);

    // Dibujar línea de cota principal (más gruesa)
    this.pdf.setLineWidth(0.4);
    this.pdf.line(ox1, oy1, ox2, oy2);

    // Dibujar flechas profesionales
    this.drawArrowProfessional(ox1, oy1, ox2, oy2, arrowSize);
    this.drawArrowProfessional(ox2, oy2, ox1, oy1, arrowSize);

    // Dibujar texto con fondo blanco para mejor legibilidad
    const textX = (ox1 + ox2) / 2;
    const textY = (oy1 + oy2) / 2;

    this.pdf.setFontSize(fontSize);
    
    // Fondo blanco para el texto
    const textWidth = this.pdf.getTextWidth(text);
    const textHeight = fontSize * 0.35; // Aproximación de altura
    
    this.pdf.setFillColor(255, 255, 255);
    this.pdf.rect(
      textX - textWidth / 2 - 1,
      textY - textHeight - 1,
      textWidth + 2,
      textHeight + 2,
      'F'
    );

    // Texto de la cota
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(text, textX, textY, { align: 'center' });
  }

  /**
   * Dibuja una flecha profesional estilo CAD
   */
  drawArrowProfessional(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    size: number = 2
  ): void {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowAngle = Math.PI / 7; // 25 grados (más agudo y profesional)

    const ax1 = x1 + size * Math.cos(angle - arrowAngle);
    const ay1 = y1 + size * Math.sin(angle - arrowAngle);
    const ax2 = x1 + size * Math.cos(angle + arrowAngle);
    const ay2 = y1 + size * Math.sin(angle + arrowAngle);

    this.pdf.setFillColor(0, 0, 0);
    this.pdf.setDrawColor(0, 0, 0);
    this.pdf.triangle(x1, y1, ax1, ay1, ax2, ay2, 'F');
  }

  /**
   * Dibuja una flecha
   */
  drawArrow(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    size: number = 2
  ): void {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowAngle = Math.PI / 6; // 30 grados

    const ax1 = x1 + size * Math.cos(angle - arrowAngle);
    const ay1 = y1 + size * Math.sin(angle - arrowAngle);
    const ax2 = x1 + size * Math.cos(angle + arrowAngle);
    const ay2 = y1 + size * Math.sin(angle + arrowAngle);

    this.pdf.setFillColor('#000000');
    this.pdf.triangle(x1, y1, ax1, ay1, ax2, ay2, 'F');
  }

  /**
   * Dibuja un círculo
   */
  drawCircle(
    x: number,
    y: number,
    radius: number,
    options?: {
      strokeColor?: string;
      fillColor?: string;
      lineWidth?: number;
    }
  ): void {
    const { strokeColor = '#000000', fillColor, lineWidth = 0.1 } = options || {};

    this.pdf.setLineWidth(lineWidth);
    this.pdf.setDrawColor(strokeColor);

    if (fillColor) {
      this.pdf.setFillColor(fillColor);
      this.pdf.circle(x, y, radius, 'FD');
    } else {
      this.pdf.circle(x, y, radius, 'S');
    }
  }

  /**
   * Dibuja texto con opciones CAD
   */
  drawText(
    text: string,
    x: number,
    y: number,
    options?: {
      fontSize?: number;
      color?: string;
      align?: 'left' | 'center' | 'right';
      angle?: number;
    }
  ): void {
    const {
      fontSize = 10,
      color = '#000000',
      align = 'left',
      angle = 0
    } = options || {};

    this.pdf.setFontSize(fontSize);
    this.pdf.setTextColor(color);

    if (angle !== 0) {
      this.pdf.text(text, x, y, { align, angle });
    } else {
      this.pdf.text(text, x, y, { align });
    }
  }

  /**
   * Dibuja un símbolo de norte
   * Nota: En PDF, Y crece hacia abajo, por lo que y - halfSize está "arriba"
   */
  drawNorthSymbol(x: number, y: number, size: number = 10): void {
    // Flecha apuntando hacia arriba (norte)
    const halfSize = size / 2;
    
    // Línea vertical (de abajo hacia arriba en coordenadas PDF)
    this.drawLine(x, y + halfSize, x, y - halfSize, { width: 0.4 });
    
    // Punta de flecha apuntando hacia arriba (hacia y menor)
    this.drawArrow(x, y - halfSize, x, y - halfSize - size / 4, size / 3);
    
    // Texto "N" encima de la flecha
    this.drawText('N', x, y - halfSize - 5, {
      fontSize: 10,
      align: 'center',
      color: '#000000'
    });
  }

  /**
   * Dibuja una cuadrícula de referencia
   */
  drawGrid(
    x: number,
    y: number,
    width: number,
    height: number,
    spacing: number,
    options?: {
      color?: string;
      lineWidth?: number;
    }
  ): void {
    const { color = '#CCCCCC', lineWidth = 0.1 } = options || {};

    this.pdf.setDrawColor(color);
    this.pdf.setLineWidth(lineWidth);

    // Líneas verticales
    for (let i = 0; i <= width; i += spacing) {
      this.pdf.line(x + i, y, x + i, y + height);
    }

    // Líneas horizontales
    for (let i = 0; i <= height; i += spacing) {
      this.pdf.line(x, y + i, x + width, y + i);
    }
  }
}
