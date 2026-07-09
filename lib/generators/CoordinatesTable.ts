import { jsPDF } from 'jspdf';
import type { LinderoRegistral } from '@/types/PlanosPayload';
import { calculateInteriorAngles, toDMS } from '@/lib/geometry/utmUtils';
import { PLANO_THEME } from '@/lib/config/PlanoTheme';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  return {
    r: parseInt(clean.substring(0, 2), 16),
    g: parseInt(clean.substring(2, 4), 16),
    b: parseInt(clean.substring(4, 6), 16),
  };
}

/**
 * Tabla "CUADRO DE DATOS TÉCNICOS (WGS84)" — única fuente de verdad visual
 * y de datos, usada tanto por el Plano Perimétrico como por la Memoria
 * Descriptiva, para que ambos folios del mismo expediente muestren
 * exactamente la misma tabla (mismas columnas, mismo formato de
 * coordenadas a 4 decimales, mismos totales, mismo estilo).
 *
 * Distancia y ángulo interno se toman de la misma fuente que ya usa el
 * resto del expediente: linderosFinal (prioridad registral) y
 * calculateInteriorAngles (lib/geometry/utmUtils).
 */
export function drawCoordinatesTechnicalTable(
  pdf: jsPDF,
  x: number,
  y: number,
  width: number,
  vertices: [number, number][],
  linderosFinal: LinderoRegistral[],
): number {
  const { TABLA_TECNICA } = PLANO_THEME;
  let cy = y;

  // Título
  pdf.setFillColor(0, 0, 0);
  pdf.rect(x, cy, width, TABLA_TECNICA.HEADER_HEIGHT, 'F');
  pdf.setTextColor(255);
  pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
  pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
  pdf.text('CUADRO DE DATOS TÉCNICOS (WGS84)', x + width / 2, cy + 4, {
    align: 'center',
  });
  cy += TABLA_TECNICA.HEADER_HEIGHT;

  // Sub-header
  const cols = ['V.', 'LADO', 'DIST.', 'ANG.', 'ESTE (X)', 'NORTE (Y)'];
  const colW = [7, 12, 17, 16, 24, 24].map((p) => (width * p) / 100);
  const headerColor = hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER);

  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.setDrawColor(0);
  pdf.rect(x, cy, width, TABLA_TECNICA.SUBHEADER_HEIGHT, 'FD');
  pdf.setTextColor(0);
  pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
  pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

  let cx = x;
  cols.forEach((c, i) => {
    pdf.text(c, cx + colW[i] / 2, cy + 3.5, { align: 'center' });
    pdf.line(cx + colW[i], cy, cx + colW[i], cy + TABLA_TECNICA.SUBHEADER_HEIGHT);
    cx += colW[i];
  });
  cy += TABLA_TECNICA.SUBHEADER_HEIGHT;

  // Filas de datos
  pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

  const angulosInternos = calculateInteriorAngles(vertices);
  const linderoPorVertice = new Map(linderosFinal.map((l) => [l.index, l]));
  const zebraColor = hexToRgb(PLANO_THEME.COLORS.TABLE_ZEBRA);

  let totalLength = 0;
  let totalAngle = 0;

  vertices.forEach((v, i) => {
    const lindero = linderoPorVertice.get(i);
    const next = (i + 1) % vertices.length;

    if (i % 2 === 0) {
      pdf.setFillColor(255, 255, 255);
    } else {
      pdf.setFillColor(zebraColor.r, zebraColor.g, zebraColor.b);
    }
    pdf.rect(x, cy, width, TABLA_TECNICA.ROW_HEIGHT, 'FD');

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

    const lenVal = lindero ? parseFloat(lindero.longitudTexto) : 0;
    totalLength += isNaN(lenVal) ? 0 : lenVal;
    const angDeg = angulosInternos[i];
    totalAngle += angDeg;

    const values = [
      `V${i + 1}`,
      lindero?.tramo ?? `V${i + 1} - V${next + 1}`,
      lindero ? `${lindero.longitudTexto}m` : '---',
      toDMS(angDeg),
      v[0].toFixed(4),
      v[1].toFixed(4),
    ];

    cx = x;
    values.forEach((val, j) => {
      pdf.text(val, cx + colW[j] / 2, cy + 3, { align: 'center' });
      pdf.line(cx + colW[j], cy, cx + colW[j], cy + TABLA_TECNICA.ROW_HEIGHT);
      cx += colW[j];
    });

    cy += TABLA_TECNICA.ROW_HEIGHT;
  });

  // Fila TOTAL
  pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
  pdf.rect(x, cy, width, TABLA_TECNICA.ROW_HEIGHT, 'FD');
  pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
  pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
  pdf.setTextColor(0);

  const labelW = colW[0] + colW[1];
  pdf.text('TOTAL', x + labelW / 2, cy + 3, { align: 'center' });

  let cxSum = x + labelW;
  pdf.text(totalLength.toFixed(2) + 'm', cxSum + colW[2] / 2, cy + 3, {
    align: 'center',
  });
  cxSum += colW[2];
  pdf.text(toDMS(totalAngle), cxSum + colW[3] / 2, cy + 3, { align: 'center' });
  cy += TABLA_TECNICA.ROW_HEIGHT;

  // Borde exterior
  pdf.setDrawColor(0);
  pdf.rect(x, y, width, cy - y);

  return cy;
}
