/**
 * PlanoPerimetricoGeneratorV2Copia.ts - Copia editable del Plano Perimétrico
 *
 * Duplicado de PlanoPerimetricoGeneratorV2.ts para poder modificar este
 * diseño sin afectar la versión en producción. Se agrega como una página
 * adicional en el expediente (justo después del Plano Perimétrico
 * original), marcada como "COPIA" en el título y en la lámina, para no
 * confundirla con la versión oficial mientras se experimenta.
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

import { jsPDF } from "jspdf";
import { CADDrawing } from "@/lib/geometry/cadDrawing";
import { utmToPaperRelative, metrosAPapel } from "@/lib/geometry/scaleUtils";
import {
  getBoundingBox,
  calculateCentroid,
  utmToLatLng,
  calculateInteriorAngles,
  DEFAULT_UTM_ZONE,
} from "@/lib/geometry/utmUtils";
import { MapService } from "@/lib/services/MapService";
import { PLANO_THEME, getGridInterval } from "@/lib/config/PlanoTheme";
import type {
  PlanoPayloadHibrido,
  LinderoRegistral,
} from "@/types/PlanosPayload";
import type { DatosProcesados } from "@/lib/services/PlanoDataProcessor";
import * as turf from "@turf/turf";
import { drawCoordinatesTechnicalTable } from "./CoordinatesTable";

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

export class PlanoPerimetricoGeneratorV2Copia {
  private payload: PlanoPayloadHibrido;
  private datosProcesados: DatosProcesados;
  private colorCache: { header: { r: number; g: number; b: number } };
  private escalaUtilizada: number | null = null;

  /**
   * Escala final (denominador) usada para dibujar el lote en este plano
   * perimétrico. Disponible recién después de llamar a generate(). La usa
   * PlanoUbicacionGenerator para mantener una proporción visual consistente
   * entre ambos documentos (ej. perimétrico 1/75 -> ubicación 1/1500).
   */
  getEscalaUtilizada(): number | null {
    return this.escalaUtilizada;
  }

  /**
   * Zona UTM (17/18/19, hemisferio sur) del lote. Cae a DEFAULT_UTM_ZONE
   * (18, Lima) si el payload no la especifica — correcto para el tráfico
   * actual, pero un proyecto fuera de esa zona necesita mandarla explícita
   * en lote.ubicacion.zonaUTM para que el mapa satelital y las coordenadas
   * lat/lng mostradas no salgan desplazadas.
   */
  private getZonaUTM(): number {
    return this.payload.loteObjetivo.properties.ubicacion?.zonaUTM ?? DEFAULT_UTM_ZONE;
  }

  constructor(payload: PlanoPayloadHibrido, datosProcesados: DatosProcesados) {
    this.payload = payload;
    this.datosProcesados = datosProcesados;
    // Pre-calcular colores para evitar conversiones repetidas
    this.colorCache = {
      header: this.hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER),
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
    const utmVertices = vertices
      .slice(0, -1)
      .map((coord) => coord as [number, number]);

    // ========== 4. CÁLCULO DE ESCALA PARA ÁREA PRINCIPAL ==========
    const escalaMain = this.calculateScaleForViewport(
      utmVertices,
      layout.drawingArea.width,
      layout.drawingArea.height,
      PLANO_THEME.LAYOUT.DIBUJO.MARGEN_INTERNO,
    );
    this.escalaUtilizada = escalaMain.escala;

    const centerX = layout.drawingArea.x + layout.drawingArea.width / 2;
    const centerY = layout.drawingArea.y + layout.drawingArea.height / 2;

    // Punto de referencia ÚNICO para todas las transformaciones UTM -> papel
    // de este documento (lote, grilla y contexto de vecinos). Antes el lote
    // se centraba con el centro del bounding box (utmToPaper) mientras que
    // la grilla y los vecinos usaban el centroide (calculateCentroid) — en
    // un lote irregular esos dos puntos no coinciden, así que el polígono
    // quedaba visualmente desfasado respecto a la grilla y al contexto.
    const centroUtm = calculateCentroid(utmVertices);

    // ========== 5-6. CONTEXTO + TÉCNICO (recortados al área de dibujo) ==========
    // El contexto de vecinos (renderContext) no tiene límites propios y se
    // dibuja a la misma escala fina del lote, así que fácilmente se sale del
    // área de dibujo. Todo lo que sigue queda encerrado en un clip exacto a
    // layout.drawingArea para que nada (contexto, grilla, lote) pinte fuera
    // de su recuadro.
    const cad = new CADDrawing(pdf);
    pdf.saveGraphicsState();
    pdf.rect(
      layout.drawingArea.x,
      layout.drawingArea.y,
      layout.drawingArea.width,
      layout.drawingArea.height,
      null,
    );
    pdf.clip();
    pdf.discardPath();

    // A. Contexto de vecinos (fondo)
    this.renderContext(
      pdf,
      cad,
      utmVertices,
      escalaMain.escala,
      centerX,
      centerY,
    );

    // B. Lote Principal (Polígono grueso destacado)
    const paperPoints = utmToPaperRelative(
      utmVertices,
      centroUtm,
      escalaMain.escala,
      centerX,
      centerY,
    );
    cad.drawPolygon(paperPoints, {
      lineWidth: PLANO_THEME.STROKES.LOTE_BOUNDARY,
      strokeColor: PLANO_THEME.COLORS.PRIMARY,
      fillColor: PLANO_THEME.COLORS.MAIN_LOTE_FILL, // Sombreado profesional solicitado
    });

    // C. Grilla UTM: se dibuja DESPUÉS del relleno del lote para que las
    // líneas queden al frente (antes el relleno opaco del lote las tapaba
    // por completo en su interior) y ANTES de vértices/cotas para que esas
    // anotaciones sigan legibles por encima de la grilla.
    this.drawRealUTMGrid(
      pdf,
      layout.drawingArea,
      utmVertices,
      escalaMain.escala,
      centerX,
      centerY,
    );

    // D. Etiqueta Central (Lote + Área + Perímetro)
    this.drawPolygonCentralData(pdf, paperPoints);

    // E. Datos Topográficos (Cotas con texto REGISTRAL, Vértices, Ángulos)
    this.drawVerticesAndDimensions(pdf, paperPoints, cad);

    // F. Título y Norte
    this.drawTitle(
      pdf,
      layout.drawingArea,
      "PLANO DE UBICACIÓN",
      paperPoints,
      escalaMain.escala,
    );
    this.drawNorthCatastro(
      pdf,
      layout.drawingArea.x +
        layout.drawingArea.width -
        PLANO_THEME.NORTE.OFFSET_X,
      layout.drawingArea.y + PLANO_THEME.NORTE.OFFSET_Y,
      PLANO_THEME.NORTE.SIZE,
    );

    // Escala del plano principal, visible directamente sobre el dibujo
    // (antes solo figuraba en el membrete de la columna derecha).
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setTextColor(0);
    pdf.text(
      `ESC. ${escalaMain.escalaTexto.trim()}`,
      layout.drawingArea.x + 3,
      layout.drawingArea.y + 5,
      { align: "left" },
    );

    pdf.restoreGraphicsState();

    // ========== 7. COLUMNA DERECHA (Información) ==========

    // 1. Título Superior
    this.drawHeaderTitleBar(pdf, layout.titleBarArea);

    // 2. Plano de Ubicación (CON AUTO-SCALE)
    await this.drawLocationPlanAutoScale(
      pdf,
      layout.ubicacionArea,
      utmVertices,
    );

    // 3. Cuadro Técnico (CON DATOS PROCESADOS)
    this.drawTechnicalTableHybrid(pdf, layout.technicalTableArea, utmVertices);

    // 4. Membrete Profesional
    await this.drawProfessionalMembrete(
      pdf,
      layout.membreteArea,
      escalaMain.escalaTexto,
    );
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
    // +15mm sobre el membrete estándar: la fila "Datos de lote / LÁMINA" se
    // duplicó de 10 a 20mm, y la fila DATUM/Zona/Escala/Fecha pasó de 1 fila
    // de 4 columnas a una grilla de 2x2 (10mm) — ver drawProfessionalMembrete.
    // Se resta del cuadro técnico (cuadroTecnicoHeight, más abajo), que es
    // el único bloque con alto "elástico" en este layout — solo afecta a
    // esta copia.
    const membreteHeight = LAYOUT.ALTURAS.MEMBRETE + 15;

    const cuadroTecnicoHeight =
      pageHeight -
      margin * 2 -
      titleBarHeight -
      ubicacionHeight -
      membreteHeight -
      gap * 3;

    return {
      titleBarArea: {
        x: colX,
        y: margin,
        width: rightColumnWidth,
        height: titleBarHeight,
      },
      ubicacionArea: {
        x: colX,
        y: margin + titleBarHeight + gap,
        width: rightColumnWidth,
        height: ubicacionHeight,
      },
      technicalTableArea: {
        x: colX,
        y: margin + titleBarHeight + gap + ubicacionHeight + gap,
        width: rightColumnWidth,
        height: cuadroTecnicoHeight,
      },
      membreteArea: {
        x: colX,
        y: pageHeight - membreteHeight - margin,
        width: rightColumnWidth,
        height: membreteHeight,
      },
      drawingArea: {
        x: margin,
        y: margin,
        width: colX - margin - gap,
        height: pageHeight - margin * 2,
      },
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
    centerY: number,
  ): void {
    const centroUtm = calculateCentroid(mainVertices);

    // Renderizar features del contexto
    this.payload.contexto.features.forEach((feature) => {
      if (feature.geometry.type !== "Polygon") return;

      const coords = feature.geometry.coordinates[0] as [number, number][];
      const paperPoints = coords.map((coord) => {
        const dx = (coord[0] - centroUtm[0]) * (1000 / escala);
        const dy = (coord[1] - centroUtm[1]) * (1000 / escala);
        return [centerX + dx, centerY - dy] as [number, number];
      });

      // Diferenciar entre calles y lotes
      if (feature.properties.tipo === "calle") {
        cad.drawPolygon(paperPoints, {
          strokeColor: PLANO_THEME.COLORS.SECONDARY,
          lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
          fillColor: "#F9F9F9",
        });
      } else {
        cad.drawPolygon(paperPoints, {
          strokeColor: PLANO_THEME.COLORS.NEIGHBOR_STROKE,
          lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
          fillColor: PLANO_THEME.COLORS.NEIGHBOR_FILL,
        });

        // Etiqueta del lote vecino
        if (feature.properties.numeroLote) {
          const center = this.calculateVisualCenter(paperPoints);
          pdf.setTextColor(
            parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16),
          );
          pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
          pdf.text(feature.properties.numeroLote, center.x, center.y, {
            align: "center",
          });
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

  private async drawLocationPlanAutoScale(
    pdf: jsPDF,
    area: AreaDibujo,
    mainVertices: [number, number][],
  ): Promise<void> {
    // 1. Header y Marco
    this.drawLocationHeader(pdf, area);

    const frameHeight = this.getUbicacionFrameHeight(area);
    const drawX = area.x + 0.5;
    const drawY = area.y + 0.5;
    const drawW = area.width - 1;
    const drawH = frameHeight - 1;

    // 2. Fondo Blanco Preventivo (Fuera de clipping para asegurar que no haya negro heredado)
    pdf.setFillColor(255, 255, 255);
    pdf.rect(drawX, drawY, drawW, drawH, "F");

    // 3. Clipping area (Máscara de recorte)
    // El borde visible de este recuadro ya lo dibuja drawLocationHeader();
    // aquí el rect es solo para definir la ruta de recorte (style=null: no
    // pinta nada), así que los vecinos/mapa no se salen de su recuadro.
    pdf.saveGraphicsState();
    try {
      pdf.rect(drawX, drawY, drawW, drawH, null);
      pdf.clip();
      pdf.discardPath();

      const modo = this.payload.configImpresion?.modoUbicacion || "vectorial";

      if (modo === "satelital") {
        try {
          const zonaUTM = this.getZonaUTM();
          const latLngs = mainVertices.map((v) => utmToLatLng(v, zonaUTM));
          const adjacentPolys: [number, number][][] = [];
          this.payload.contexto.features.forEach((f) => {
            if (f.properties.tipo === "lote" && f.geometry.type === "Polygon") {
              adjacentPolys.push(
                (f.geometry.coordinates[0] as [number, number][]).map((v) =>
                  utmToLatLng(v, zonaUTM),
                ),
              );
            }
          });

          // Obtener mapa como Buffer/Uint8Array
          const mapRes = await MapService.getStaticMapBuffer(
            latLngs,
            Math.round(drawW * 4),
            Math.round(drawH * 4),
            17,
            2,
            "satellite",
            adjacentPolys,
          );

          if (mapRes) {
            try {
              const format = mapRes.mimeType.includes("png") ? "PNG" : "JPEG";
              pdf.addImage(
                mapRes.data,
                format,
                drawX,
                drawY,
                drawW,
                drawH,
                undefined,
                "FAST",
              );
              pdf.rect(drawX, drawY, drawW, drawH);
            } catch (imgError) {
              console.warn("Error adding satellite buffer to PDF:", imgError);
              this.renderVectorLocationSketch(
                pdf,
                drawX,
                drawY,
                drawW,
                drawH,
                mainVertices,
                area,
              );
            }
          } else {
            this.renderVectorLocationSketch(
              pdf,
              drawX,
              drawY,
              drawW,
              drawH,
              mainVertices,
              area,
            );
          }
        } catch (error) {
          console.warn("Error rendering satellite location sketch:", error);
          this.renderVectorLocationSketch(
            pdf,
            drawX,
            drawY,
            drawW,
            drawH,
            mainVertices,
            area,
          );
        }
      } else if (modo === "imagen") {
        const imageUrl = this.payload.configImpresion?.imagenGeneral;
        if (imageUrl) {
          try {
            const res = await fetch(imageUrl);
            if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
            const buffer = await res.arrayBuffer();
            const data = new Uint8Array(buffer);
            const contentType = res.headers.get("content-type") || "";
            const format = contentType.includes("png") ? "PNG" : "JPEG";

            pdf.addImage(
              data,
              format,
              drawX,
              drawY,
              drawW,
              drawH,
              undefined,
              "FAST",
            );
            pdf.rect(drawX, drawY, drawW, drawH);
          } catch (error) {
            console.warn("Error processing general image buffer:", error);
            this.renderVectorLocationSketch(
              pdf,
              drawX,
              drawY,
              drawW,
              drawH,
              mainVertices,
              area,
            );
          }
        } else {
          this.renderVectorLocationSketch(
            pdf,
            drawX,
            drawY,
            drawW,
            drawH,
            mainVertices,
            area,
          );
        }
      } else {
        this.renderVectorLocationSketch(
          pdf,
          drawX,
          drawY,
          drawW,
          drawH,
          mainVertices,
          area,
        );
      }
    } finally {
      pdf.restoreGraphicsState();
    }

    this.drawNorthCatastro(pdf, area.x + area.width - 8, area.y + 15, 8);
  }

  /**
   * Renderizado vectorial clásico del croquis (Extraído de drawLocationPlanAutoScale)
   */
  private renderVectorLocationSketch(
    pdf: jsPDF,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
    mainVertices: [number, number][],
    area: AreaDibujo,
  ): void {
    const { UBICACION } = PLANO_THEME;

    // El auto-fit no debe encuadrar el 100% de la extensión recolectada
    // (lote + todos los vecinos del payload): eso deja el lote como un punto
    // diminuto perdido entre manzanas lejanas. Fingimos que el contenido a
    // encuadrar es solo una fracción de su ancho/alto real, así el zoom
    // queda más cerrado y el lote se ve prominente; lo que sobra del
    // contexto recolectado queda fuera del recuadro (el clip de
    // drawLocationPlanAutoScale ya se encarga de recortarlo limpiamente, no
    // hace falta filtrar antes). 0.72 = zoom extendido 20% respecto al 0.6
    // anterior (más zoom-out, se ve más contexto alrededor del lote).
    const CONTEXT_VISIBLE_FRACTION = 0.72;

    // 2. Recolectar coordenadas para el BBox: TODOS los vecinos del payload,
    // sin filtro de radio propio. Antes había un MAX_RADIUS=70m hardcodeado
    // aquí que descartaba vecinos antes de dibujarlos, aunque el resto del
    // documento (renderContext del plano principal, PlanoUbicacion.ts) sí
    // los muestra — el radio real de contexto lo decide quien arma el
    // payload (mapa_renasur), no este thumbnail.
    const validCoords: [number, number][] = [...mainVertices];
    const filteredFeatures: any[] = [];

    if (this.payload.contexto && this.payload.contexto.features) {
      this.payload.contexto.features.forEach((f) => {
        if (f.geometry.type === "Polygon") {
          const coords = f.geometry.coordinates[0] as [number, number][];
          validCoords.push(...coords);
          filteredFeatures.push(f);
        }
      });
    }

    // 3. Calcular Escala y BBox
    const bbox = getBoundingBox(validCoords);
    const contentW = bbox.width || 50;
    const contentH = bbox.height || 50;
    const marginFactor = UBICACION.MARGIN_FACTOR;

    // rawScale son mm de papel por metro real (dx_mm = dx_metros * rawScale).
    // El mínimo de los dos ejes es lo más grande que cabe sin desbordar.
    // Se divide por CONTEXT_VISIBLE_FRACTION para encuadrar solo ese
    // porcentaje del contenido (ver comentario junto a MAX_RADIUS).
    const rawScaleNecesaria = Math.min(
      (drawW * marginFactor) / (contentW * CONTEXT_VISIBLE_FRACTION),
      (drawH * marginFactor) / (contentH * CONTEXT_VISIBLE_FRACTION),
    );

    // Denominador de escala "1:N" correspondiente: N = 1000 / (mm por metro).
    // (La fórmula anterior usaba 25.4 en vez de 1000, mostrando un número de
    // escala que no correspondía a lo realmente dibujado.)
    const nominalNecesario = 1000 / Math.max(rawScaleNecesaria, 0.0001);

    // Redondear SIEMPRE hacia una escala estándar más alejada (nunca más
    // cercana): así el dibujo real nunca ocupa más espacio del necesario y
    // jamás se desborda del recuadro, y además el número que se imprime es
    // uno reconocible por cualquier escalímetro (750, 1000, 1500...), igual
    // que ya hace el plano de ubicación de la página 4.
    const ESCALAS_ESTANDAR = [100, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000, 7500, 10000];
    const escalaNominal = ESCALAS_ESTANDAR.find((s) => s >= nominalNecesario)
      ?? Math.ceil(nominalNecesario / 500) * 500;

    const rawScale = 1000 / escalaNominal;

    // Escala fuera del recuadro (debajo del nombre "PLANO DE LOCALIZACIÓN",
    // que también va debajo del marco — ver drawLocationHeader). Mismo
    // formato "ESCALA: 1/N" que el título principal, para consistencia.
    const frameHeightCaption = this.getUbicacionFrameHeight(area);
    pdf.setFontSize(6);
    pdf.setTextColor(0);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(
      `ESCALA: 1/${escalaNominal}`,
      area.x + area.width / 2,
      area.y + frameHeightCaption + 7.5,
      { align: "center" },
    );

    // 4. Transformación
    const bboxCX = (bbox.minX + bbox.maxX) / 2;
    const bboxCY = (bbox.minY + bbox.maxY) / 2;
    const pdfCX = drawX + drawW / 2;
    const pdfCY = drawY + drawH / 2;
    const transform = (p: [number, number]) => {
      const dx = (p[0] - bboxCX) * rawScale;
      const dy = (p[1] - bboxCY) * rawScale;
      return [pdfCX + dx, pdfCY - dy] as [number, number];
    };

    // 5. Dibujo Contexto (Vecinos y Calles)
    filteredFeatures.forEach((feature) => {
      const pts = (feature.geometry.coordinates[0] as [number, number][]).map(
        transform,
      );
      if (pts.length < 2) return;

      const isCalle = feature.properties.tipo === "calle";

      // Estilos semánticos desde THEME
      if (isCalle) {
        pdf.setDrawColor(200);
        pdf.setLineWidth(0.05);
        pdf.setFillColor(250, 250, 250);
      } else {
        pdf.setDrawColor(
          parseInt(PLANO_THEME.COLORS.NEIGHBOR_STROKE.slice(1, 3), 16),
        );
        pdf.setLineWidth(UBICACION.VECINO_LINE_WIDTH);
        pdf.setFillColor(252, 252, 252);
      }

      pdf.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) pdf.lineTo(pts[i][0], pts[i][1]);
      pdf.close();
      pdf.fillStroke();
    });

    // 6. Dibujo Lote Principal (Encima de todo)
    const lotePts = mainVertices.map(transform);
    if (lotePts.length > 2) {
      pdf.setDrawColor(0);
      pdf.setLineWidth(UBICACION.LOTE_LINE_WIDTH);
      pdf.setFillColor(
        parseInt(PLANO_THEME.COLORS.MAIN_LOTE_FILL.slice(1, 3), 16),
        parseInt(PLANO_THEME.COLORS.MAIN_LOTE_FILL.slice(3, 5), 16),
        parseInt(PLANO_THEME.COLORS.MAIN_LOTE_FILL.slice(5, 7), 16),
      );

      pdf.moveTo(lotePts[0][0], lotePts[0][1]);
      for (let i = 1; i < lotePts.length; i++)
        pdf.lineTo(lotePts[i][0], lotePts[i][1]);
      pdf.close();
      pdf.fillStroke();

      // Callout "aquí está el lote": círculo + línea guía a una etiqueta en
      // zona despejada del recuadro, en vez de un texto diminuto adentro del
      // propio lote (ilegible a esta escala, con 40+ vecinos alrededor).
      // Convención estándar de planos de ubicación profesionales.
      const centerLote = this.calculateVisualCenter(lotePts);
      const loteBBox = getBoundingBox(lotePts);
      const circleRadius =
        Math.sqrt(loteBBox.width ** 2 + loteBBox.height ** 2) / 2 + 1.5;

      pdf.setDrawColor(0);
      pdf.setLineWidth(0.25);
      pdf.circle(centerLote.x, centerLote.y, circleRadius, "S");

      // Línea guía hacia abajo-izquierda: el header ocupa arriba y la
      // flecha Norte la esquina superior derecha, así que esa diagonal es
      // la zona más despejada con más frecuencia. Se recorta (clamp) para
      // que la etiqueta nunca salga del recuadro dibujable.
      const dirX = -0.7071;
      const dirY = 0.7071; // Y crece hacia abajo en este espacio de papel
      const leaderStartX = centerLote.x + circleRadius * dirX;
      const leaderStartY = centerLote.y + circleRadius * dirY;
      const leaderLength = Math.min(drawW, drawH) * 0.3;

      const labelText = `LOTE ${this.payload.loteObjetivo.properties.identificador.lote}`;
      pdf.setFontSize(6);
      pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
      const labelWidth = pdf.getTextWidth(labelText);

      const rawEndX = centerLote.x + (circleRadius + leaderLength) * dirX;
      const rawEndY = centerLote.y + (circleRadius + leaderLength) * dirY;
      const labelX = Math.max(drawX + 2, Math.min(drawX + drawW - labelWidth - 2, rawEndX));
      const labelY = Math.max(drawY + 5, Math.min(drawY + drawH - 2, rawEndY));

      pdf.setLineWidth(0.3);
      pdf.line(leaderStartX, leaderStartY, labelX, labelY);
      pdf.setFillColor(0, 0, 0);
      pdf.circle(leaderStartX, leaderStartY, 0.4, "F");

      // Fondo blanco con borde bajo la etiqueta para que se lea encima del contexto
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(0);
      pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
      pdf.rect(labelX - 1, labelY - 3.3, labelWidth + 2, 4.3, "FD");
      pdf.setTextColor(0);
      pdf.text(labelText, labelX, labelY, { align: "left" });
    }
  }

  // Alto reservado DEBAJO del recuadro del croquis para el nombre
  // "PLANO DE LOCALIZACIÓN" y su escala (ambos fuera del marco, no
  // encimados con el dibujo ni con la barra de título). Se resta del mismo
  // alto total ya asignado al bloque (UBICACION.ALTURAS), así el recuadro
  // queda más chico pero nada se sale de su espacio ni choca con el
  // cuadro técnico de abajo.
  private readonly UBICACION_CAPTION_RESERVE = 9;

  private getUbicacionFrameHeight(area: AreaDibujo): number {
    return area.height - this.UBICACION_CAPTION_RESERVE;
  }

  private drawLocationHeader(pdf: jsPDF, area: AreaDibujo) {
    const frameHeight = this.getUbicacionFrameHeight(area);

    // Marco (sin barra de título interna: el nombre va debajo del recuadro)
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(area.x, area.y, area.width, frameHeight);

    // Nombre del plano, debajo del recuadro (antes iba en una barra dentro
    // del marco, arriba; y se llamaba "CROQUIS DE UBICACIÓN").
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(
      "PLANO DE LOCALIZACIÓN",
      area.x + area.width / 2,
      area.y + frameHeight + 3.5,
      { align: "center" },
    );
  }

  /**
   * Calcula escala automática para el plano de ubicación
   */
  private calculateAutoScaleForContext(
    mainVertices: [number, number][],
  ): number {
    const allCoords: [number, number][] = [...mainVertices];
    this.payload.contexto.features.forEach((feature) => {
      if (feature.geometry.type === "Polygon") {
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
  private drawTechnicalTableHybrid(
    pdf: jsPDF,
    area: AreaDibujo,
    vertices: [number, number][],
  ): void {
    // Tabla compartida con la Memoria Descriptiva (misma fuente de verdad
    // visual y de datos, ver lib/generators/CoordinatesTable.ts) para que
    // ambos folios del expediente muestren exactamente el mismo cuadro.
    drawCoordinatesTechnicalTable(
      pdf,
      area.x,
      area.y,
      area.width,
      vertices,
      this.datosProcesados.linderosFinal,
    );
  }

  // ==========================================================================
  // ETIQUETADO DE COTAS (USANDO TEXTO REGISTRAL)
  // ==========================================================================

  private drawInternalAngle(
    pdf: jsPDF,
    p: [number, number],
    prev: [number, number],
    next: [number, number],
    label: string,
    expectedVal: number,
  ): void {
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
    const reflexDiff = Math.abs(360 - sweepDeg - expectedVal);

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
    pdf.lines(
      [],
      p[0] + Math.cos(startAngle) * radius,
      p[1] + Math.sin(startAngle) * radius,
    ); // Move

    for (let i = 1; i <= 8; i++) {
      const a = startAngle + step * i;
      const x = p[0] + Math.cos(a) * radius;
      const y = p[1] + Math.sin(a) * radius;
      pdf.line(
        p[0] + Math.cos(a - step) * radius,
        p[1] + Math.sin(a - step) * radius,
        x,
        y,
      );
    }

    // Label del ángulo
    const midAngle = startAngle + sweep / 2;
    const lblX = p[0] + Math.cos(midAngle) * (radius + 2);
    const lblY = p[1] + Math.sin(midAngle) * (radius + 2);

    pdf.setFontSize(5);
    pdf.setTextColor(80);
    pdf.text(label, lblX, lblY, { align: "center", baseline: "middle" });
  }

  /**
   * Dibuja dimensiones de lados usando longitudTexto registral
   */

  private drawVerticesAndDimensions(
    pdf: jsPDF,
    paperPoints: [number, number][],
    cad: CADDrawing,
  ): void {
    // Ángulos internos: única fuente de verdad (lib/geometry/utmUtils),
    // robusta ante el sentido de recorrido del polígono. Funciona igual en
    // espacio papel (Y invertido) que en UTM porque detecta la orientación
    // a partir del propio arreglo de puntos recibido.
    const angulosInternos = calculateInteriorAngles(paperPoints);

    // Vértices y Ángulos
    paperPoints.forEach((p, i) => {
      // 1. Dibujar Ángulos Internos
      const prev =
        paperPoints[(i - 1 + paperPoints.length) % paperPoints.length];
      const next = paperPoints[(i + 1) % paperPoints.length];

      const computedAngle = angulosInternos[i];
      const angleLabel = `${computedAngle.toFixed(2)}°`;

      this.drawInternalAngle(pdf, p, prev, next, angleLabel, computedAngle);

      // 2. Dibujar Vértice
      cad.drawCircle(p[0], p[1], 0.8, { fillColor: PLANO_THEME.COLORS.WHITE });

      // Dirección hacia el EXTERIOR del lote en este vértice: la suma de los
      // vectores unitarios hacia los dos vecinos siempre bisecta el ángulo
      // que forman (geometría vectorial básica). Si el vértice es convexo
      // (ángulo interno <=180°) esa bisectriz apunta hacia ADENTRO del lote,
      // así que se invierte; si es cóncavo/reflejo (>180°) la bisectriz ya
      // apunta hacia afuera (hacia la "muesca"), sin invertir. Con esto la
      // etiqueta "V{n}" queda fuera del lote sin importar la forma —
      // convexa, cóncava, o el offset fijo anterior (+2,-2) que a veces
      // caía adentro del relleno gris según la geometría.
      const toPrevX = prev[0] - p[0];
      const toPrevY = prev[1] - p[1];
      const toNextX = next[0] - p[0];
      const toNextY = next[1] - p[1];
      const lenPrev = Math.sqrt(toPrevX ** 2 + toPrevY ** 2) || 1;
      const lenNext = Math.sqrt(toNextX ** 2 + toNextY ** 2) || 1;
      const sumX = toPrevX / lenPrev + toNextX / lenNext;
      const sumY = toPrevY / lenPrev + toNextY / lenNext;
      const sumLen = Math.sqrt(sumX ** 2 + sumY ** 2);

      let outX: number;
      let outY: number;
      if (sumLen < 1e-6) {
        // Caso degenerado: vértice casi colineal con sus vecinos (raro en
        // lotes reales, ej. un vértice redundante en un lado recto). Se usa
        // la perpendicular del lado siguiente como respaldo.
        outX = -toNextY / lenNext;
        outY = toNextX / lenNext;
      } else {
        const sign = computedAngle <= 180 ? -1 : 1;
        outX = (sign * sumX) / sumLen;
        outY = (sign * sumY) / sumLen;
      }

      const labelOffset = 3; // mm desde el vértice
      pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
      pdf.setTextColor(0);
      pdf.text(
        `V${i + 1}`,
        p[0] + outX * labelOffset,
        p[1] + outY * labelOffset,
        { align: "center", baseline: "middle" },
      );
    });

    // Cotas (dimensiones) - USANDO longitudTexto REGISTRAL, orientadas en la
    // dirección real del lado que etiquetan (convención CAD estándar), en
    // vez de texto siempre horizontal sin relación visual con la línea.
    // Centroide (aprox.) del lote: sirve solo para decidir hacia qué lado
    // de la línea cae el interior, no para geometría de precisión.
    const centroidEtiquetas = this.calculateVisualCenter(paperPoints);
    const INWARD_LABEL_OFFSET = 3; // mm hacia adentro del lote
    const SIDE_LABEL_FONT = PLANO_THEME.FONTS.SIZES.SMALL * 1.7; // +70% a pedido

    this.datosProcesados.linderosFinal.forEach(
      (lindero: LinderoRegistral, i: number) => {
        const p = paperPoints[i];
        const next = paperPoints[(i + 1) % paperPoints.length];
        const midX = (p[0] + next[0]) / 2;
        const midY = (p[1] + next[1]) / 2;

        const dx = next[0] - p[0];
        const dy = next[1] - p[1];

        // Ángulo para pdf.text({angle}): en el espacio mm expuesto por jsPDF
        // (Y hacia abajo), el vector de avance del texto para un ángulo dado
        // en grados es (cos(ángulo), -sin(ángulo)) — ver verificación con las
        // matrices Tm reales del PDF hecha para las etiquetas de grilla.
        // Se normaliza a [-90°, 90°] para que el texto nunca quede al revés,
        // conservando el paralelismo con la línea (da igual la dirección de
        // recorrido del lado).
        let angleDeg = Math.atan2(-dy, dx) * (180 / Math.PI);
        if (angleDeg > 90) angleDeg -= 180;
        else if (angleDeg < -90) angleDeg += 180;
        const angleRad = (angleDeg * Math.PI) / 180;
        const fux = Math.cos(angleRad);
        const fuy = -Math.sin(angleRad);
        let fperpX = -fuy;
        let fperpY = fux;

        // La perpendicular (fperpX, fperpY) puede apuntar hacia cualquiera
        // de los dos lados de la línea según su orientación; se verifica
        // contra el centroide y se invierte si hace falta para que SIEMPRE
        // apunte hacia el interior del lote.
        const toCentroidX = centroidEtiquetas.x - midX;
        const toCentroidY = centroidEtiquetas.y - midY;
        if (fperpX * toCentroidX + fperpY * toCentroidY < 0) {
          fperpX = -fperpX;
          fperpY = -fperpY;
        }

        // Punto medio del lado, desplazado hacia adentro del lote (antes la
        // etiqueta se dibujaba justo sobre la línea del lindero).
        const mx = midX + fperpX * INWARD_LABEL_OFFSET;
        const my = midY + fperpY * INWARD_LABEL_OFFSET;

        const textStr = `${lindero.longitudTexto}m`;
        pdf.setFontSize(SIDE_LABEL_FONT);
        pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
        const textWidth = pdf.getTextWidth(textStr);

        // NI align:"center" NI baseline:"middle" de jsPDF son seguros de usar
        // junto con angle: ambos calculan su desplazamiento sobre los ejes
        // ORIGINALES (mundo X para align, eje Y original para baseline)
        // ANTES de aplicar la matriz de rotación — no la giran junto con el
        // texto. Confirmado en el código fuente de jsPDF (align: "x -=
        // lineWidths[0] / 2" corre antes de construir la matriz de ángulo).
        // El error resultante crece con el ángulo (era de ~4mm en lados a
        // 75°, ~1mm en lados a 15°) — por eso se calculan ambos
        // desplazamientos a mano, ya proyectados sobre la dirección real
        // (adelante/perpendicular) del texto rotado, y se llama a text() sin
        // align/baseline (default "left"/"alphabetic" con el ancla
        // ya pre-corrida).
        const fontHeightMm = SIDE_LABEL_FONT / pdf.internal.scaleFactor;
        const middleOffset = fontHeightMm * 0.35; // height/2 - height*0.15 (lineHeightFactor=1.15)
        const halfWidth = textWidth / 2;
        const anchorX = mx + fperpX * middleOffset - fux * halfWidth;
        const anchorY = my + fperpY * middleOffset - fuy * halfWidth;

        pdf.setTextColor(0);
        // ⭐ USAR longitudTexto del registro, NO calcular
        pdf.text(textStr, anchorX, anchorY, { angle: angleDeg });
      },
    );
  }

  // ==========================================================================
  // MÉTODOS AUXILIARES
  // ==========================================================================

  private drawPolygonCentralData(
    pdf: jsPDF,
    paperPoints: [number, number][],
  ): void {
    const center = this.calculatePoleOfInaccessibility(paperPoints);
    const loteProps = this.payload.loteObjetivo.properties;

    // Fuente de "A = .../P = ..." aumentada 50% a pedido (SMALL 6pt -> 9pt).
    // La caja y el espaciado se recalculan a partir del ancho real del texto
    // (en vez de PLANO_THEME.ETIQUETA_CENTRAL, pensado para la fuente
    // original) para que no se desborden con la fuente más grande; el tema
    // compartido no se toca, así el Plano Perimétrico oficial no cambia.
    const AREA_PERIMETRO_FONT = PLANO_THEME.FONTS.SIZES.SMALL * 1.5;
    const LOTE_FONT = PLANO_THEME.FONTS.SIZES.BODY;
    const lineSpacing = PLANO_THEME.ETIQUETA_CENTRAL.LINE_SPACING * 1.5;

    const perimetroVisual = this.datosProcesados.linderosFinal.reduce(
      (sum, l) => sum + parseFloat(l.longitudTexto),
      0,
    );
    const loteText = `LOTE ${loteProps.identificador.lote}`;
    const areaText = `A = ${this.datosProcesados.areaFinal.toFixed(2)} m²`;
    const perimText = `P = ${perimetroVisual.toFixed(2)} ml`;

    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(LOTE_FONT);
    const loteWidth = pdf.getTextWidth(loteText);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.setFontSize(AREA_PERIMETRO_FONT);
    const areaWidth = pdf.getTextWidth(areaText);
    const perimWidth = pdf.getTextWidth(perimText);

    const PADDING_H = 3;
    const boxWidth = Math.max(loteWidth, areaWidth, perimWidth) + PADDING_H * 2;
    const loteY = center.y - 3;
    const areaY = center.y + 2;
    const perimY = areaY + lineSpacing;
    const boxHeight = perimY - loteY + 6; // margen arriba/abajo del contenido

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
    pdf.rect(
      center.x - boxWidth / 2,
      center.y - boxHeight / 2,
      boxWidth,
      boxHeight,
      "FD",
    );

    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(LOTE_FONT);
    pdf.setTextColor(0);
    pdf.text(loteText, center.x, loteY, { align: "center" });

    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.setFontSize(AREA_PERIMETRO_FONT);
    pdf.text(areaText, center.x, areaY, { align: "center" });
    pdf.text(perimText, center.x, perimY, { align: "center" });
  }

  private drawHeaderTitleBar(pdf: jsPDF, area: AreaDibujo): void {
    const { x, y, width, height } = area;

    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, width, height, "F");

    const splitX = x + width * 0.7;

    pdf.setTextColor(255, 255, 255);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H2);
    pdf.text(
      "PLANO PERIMÉTRICO Y UBICACIÓN",
      x + (splitX - x) / 2,
      y + height / 2 + 4,
      { align: "center" },
    );

    pdf.setDrawColor(255);
    pdf.setLineWidth(PLANO_THEME.STROKES.SEPARATOR);
    pdf.line(splitX, y, splitX, y + height);

    const codeAreaW = width - (splitX - x);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(splitX + 2, y + 2, codeAreaW - 4, height - 4, "F");

    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.text("LÁMINA Nº", splitX + 5, y + 5);

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H3);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text("PP-01B", splitX + codeAreaW / 2 + 1, y + 9, { align: "center" });

    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    const lineW = 10;
    const lineX = splitX + codeAreaW / 2 + 1 - lineW / 2;
    pdf.line(lineX, y + 9.5, lineX + lineW, y + 9.5);
  }

  private async drawProfessionalMembrete(
    pdf: jsPDF,
    area: AreaDibujo,
    escala: string,
  ): Promise<void> {
    // Membrete rediseñado en formato de sello clásico (cuadro de datos +
    // "LÁMINA"), a pedido explícito, en vez del logo + filas de la versión
    // oficial (PlanoPerimetricoGeneratorV2.ts) — solo en esta copia.
    const { x, y, width: w, height: h } = area;
    const loteProps = this.payload.loteObjetivo.properties;
    const ubicacion = loteProps.ubicacion;

    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(x, y, w, h);

    let cy = y;

    // 1. Título (dos líneas, centrado, con su propio recuadro)
    const titleH = 9;
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setTextColor(0);
    pdf.text("PLANO DE UBICACIÓN", x + w / 2, cy + 4, { align: "center" });
    pdf.text("Y LOCALIZACIÓN", x + w / 2, cy + 7.5, { align: "center" });
    cy += titleH;
    pdf.line(x, cy, x + w, cy);

    // 2. Datos administrativos (label : value), una columna
    const labelX = x + 2;
    const valueX = x + 32;
    const datosFilas: Array<[string, string]> = [
      ["Departamento", ubicacion?.departamento || "---"],
      ["Provincia", ubicacion?.provincia || "---"],
      ["Distrito", ubicacion?.distrito || "---"],
      ["Urbanización", loteProps.identificador.urbanizacion || "---"],
      ["Vía de acceso a\nurbanización", ubicacion?.direccion || "---"],
      ["Manzana", loteProps.identificador.manzana],
      ["Lote", loteProps.identificador.lote],
    ];
    const filaAltos = [3.2, 3.2, 3.2, 3.2, 6, 3.2, 3.2]; // mm, "Vía de acceso" ocupa 2 líneas
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

    // Línea base SIEMPRE a "rowH - 1mm" (nunca fija): así el texto queda a
    // 1mm del borde inferior de su propia celda sin importar el alto de la
    // fila, evitando que se dibuje encima/debajo del recuadro (el bug de
    // la captura: el valor de una fila se salía de su celda porque el alto
    // reservado era menor que la posición fija usada para el texto).
    datosFilas.forEach(([label, value], i) => {
      const rowH = filaAltos[i];
      const lineas = label.split("\n");
      pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
      pdf.setTextColor(0);
      if (lineas.length > 1) {
        pdf.text(lineas[0], labelX, cy + rowH / 2 - 0.6);
        pdf.text(lineas[1], labelX, cy + rowH - 1);
      } else {
        pdf.text(lineas[0], labelX, cy + rowH - 1);
      }
      pdf.text(":", valueX - 2, cy + rowH - 1);
      pdf.text(value, valueX, cy + rowH - 1);
      cy += rowH;
      pdf.setDrawColor(200);
      pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
      pdf.line(x, cy, x + w, cy);
    });

    // 3. Proyecto (fila completa, centrada, en negrita)
    const proyectoH = 5;
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.text(
      `PROYECTO: HABILITACIÓN URBANA "${
        loteProps.identificador.urbanizacion || "TERRA LIMA"
      }"`,
      x + w / 2,
      cy + proyectoH / 2 + 1.5,
      { align: "center" },
    );
    cy += proyectoH;
    pdf.line(x, cy, x + w, cy);

    // 4. Datos de lote (izq., arriba) + grilla 2x2 DATUM/Zona/Escala/Fecha
    // (izq., abajo) + LÁMINA (derecha, altura completa de todo el bloque) —
    // igual a la imagen de referencia: antes DATUM/Zona/Escala/Fecha era
    // una sola fila de 4 columnas que cruzaba por debajo de LÁMINA.
    const laminaColX = x + w * 0.72;
    const datosLoteH = 20; // duplicado a pedido (antes 10mm)
    const datumRowH = 5; // cada una de las 2 filas de la grilla 2x2
    const datumGridH = datumRowH * 2;
    const combinedBlockH = datosLoteH + datumGridH;

    // Línea vertical de LÁMINA: cubre todo el bloque combinado (Datos de
    // lote + grilla DATUM), no solo la fila superior.
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.line(laminaColX, cy, laminaColX, cy + combinedBlockH);

    // --- Datos de lote (arriba, izquierda) ---
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.text("Datos de lote:", labelX, cy + 3.2);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text(
      `Área: ${this.datosProcesados.areaFinal.toFixed(2)} m2`,
      labelX,
      cy + 6.4,
    );
    pdf.text(
      `Perímetro: ${this.datosProcesados.perimetroFinal.toFixed(2)} m`,
      labelX,
      cy + 9.2,
    );

    // --- LÁMINA / PU-01, centrado en TODO el bloque combinado ---
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.text(
      "LÁMINA:",
      laminaColX + (x + w - laminaColX) / 2,
      cy + combinedBlockH / 2 - 2.75,
      { align: "center" },
    );
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H2);
    pdf.text(
      "PU - 01",
      laminaColX + (x + w - laminaColX) / 2,
      cy + combinedBlockH / 2 + 2.75,
      { align: "center" },
    );

    cy += datosLoteH;
    pdf.setDrawColor(0);
    // Separador entre "Datos de lote" y la grilla DATUM: solo hasta
    // laminaColX (la columna de LÁMINA sigue de corrido, sin cortarse).
    pdf.line(x, cy, laminaColX, cy);

    // --- Grilla 2x2: DATUM/Zona Geográfica (fila 1), Escala/Fecha (fila 2),
    // confinada al ancho izquierdo (hasta laminaColX) ---
    const zonaUTM = this.getZonaUTM();
    const fechaMesAnio = new Date().toLocaleDateString("es-PE", {
      month: "long",
      year: "numeric",
    });

    const gridColMid = x + (laminaColX - x) / 2;
    pdf.line(gridColMid, cy, gridColMid, cy + datumGridH);

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    const drawDatumCell = (
      colX: number,
      rowY: number,
      label: string,
      value: string,
    ) => {
      pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
      pdf.text(label, colX, rowY);
      const labelW = pdf.getTextWidth(label);
      pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
      pdf.text(value, colX + labelW + 1.5, rowY);
    };

    // Fila 1: DATUM | Zona Geográfica
    const row1Y = cy + datumRowH / 2 + 1.5;
    drawDatumCell(labelX, row1Y, "DATUM:", "WGS 84");
    drawDatumCell(gridColMid + 1.5, row1Y, "Zona Geográfica:", `${zonaUTM}S`);
    cy += datumRowH;
    pdf.line(x, cy, laminaColX, cy);

    // Fila 2: Escala | Fecha
    const row2Y = cy + datumRowH / 2 + 1.5;
    drawDatumCell(labelX, row2Y, "Escala:", "Indicada");
    drawDatumCell(gridColMid + 1.5, row2Y, "Fecha:", fechaMesAnio);
  }

  private drawRealUTMGrid(
    pdf: jsPDF,
    area: AreaDibujo,
    vertices: [number, number][],
    escala: number,
    cx: number,
    cy: number,
  ): void {
    const centroUtm = calculateCentroid(vertices);
    const interval = getGridInterval(escala);

    const viewWMeters = (area.width / 1000) * escala;
    const viewHMeters = (area.height / 1000) * escala;

    const minUtmX = centroUtm[0] - viewWMeters / 2;
    const maxUtmX = centroUtm[0] + viewWMeters / 2;
    const minUtmY = centroUtm[1] - viewHMeters / 2;
    const maxUtmY = centroUtm[1] + viewHMeters / 2;

    const startX = Math.ceil(minUtmX / interval) * interval;
    const startY = Math.ceil(minUtmY / interval) * interval;

    pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
    const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
    pdf.setDrawColor(grayVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

    // Líneas Verticales (etiqueta ESTE en ambos extremos: abajo y arriba)
    for (let x = startX; x <= maxUtmX; x += interval) {
      const px = cx + metrosAPapel(x - centroUtm[0], escala);
      if (px > area.x && px < area.x + area.width) {
        pdf.line(px, area.y, px, area.y + area.height);
        // Abajo: el texto crece hacia arriba (adentro del recuadro) desde el
        // borde inferior. Arriba: con el mismo angle=90 el texto crecería en
        // la MISMA dirección absoluta (hacia arriba), es decir hacia AFUERA
        // del recuadro desde un ancla pegada al borde superior — por eso se
        // veía cortado. Se invierte el ángulo (-90) para que crezca hacia
        // abajo, adentro del recuadro, igual que el de abajo pero en espejo.
        pdf.text(`${x}E`, px - 2, area.y + area.height - 2, { angle: 90 });
        pdf.text(`${x}E`, px - 2, area.y + 2, { angle: -90 });
      }
    }

    // Líneas Horizontales (etiqueta NORTE en ambos extremos: derecha e izquierda)
    for (let y = startY; y <= maxUtmY; y += interval) {
      const py = cy - metrosAPapel(y - centroUtm[1], escala);
      if (py > area.y && py < area.y + area.height) {
        pdf.line(area.x, py, area.x + area.width, py);
        pdf.text(`${y}N`, area.x + area.width - 2, py - 1, {
          align: "right",
        });
        pdf.text(`${y}N`, area.x + 2, py - 1, { align: "left" });
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
    pdf.rect(
      MARCO.EXTERNO_OFFSET,
      MARCO.EXTERNO_OFFSET,
      w - MARCO.EXTERNO_OFFSET * 2,
      h - MARCO.EXTERNO_OFFSET * 2,
    );

    pdf.setLineWidth(MARCO.INTERNO_WIDTH);
    pdf.rect(
      MARCO.INTERNO_OFFSET,
      MARCO.INTERNO_OFFSET,
      w - MARCO.INTERNO_OFFSET * 2,
      h - MARCO.INTERNO_OFFSET * 2,
    );
  }

  private drawTitle(
    pdf: jsPDF,
    area: AreaDibujo,
    title: string,
    paperPoints?: Array<[number, number]>,
    escalaValue?: number,
  ): void {
    const { TITULO } = PLANO_THEME;

    const centerX = area.x + area.width / 2;

    // Posicionar el título debajo del punto más bajo del polígono dibujado
    // (no un offset fijo desde el borde), para que lotes alargados o rotados
    // que se extiendan hacia abajo no queden tapados por el título.
    const defaultTitleY = area.y + area.height - TITULO.OFFSET_BOTTOM;
    let titleY = defaultTitleY;
    if (paperPoints && paperPoints.length > 0) {
      const maxPolygonY = Math.max(...paperPoints.map(([, y]) => y));
      const CLEARANCE_BELOW_POLYGON = 12; // mm: espacio para cotas + separación visual
      const MIN_MARGIN_FROM_FRAME = 8; // mm: no pegar el título al marco inferior
      const desiredY = maxPolygonY + CLEARANCE_BELOW_POLYGON;
      const maxAllowedY = area.y + area.height - MIN_MARGIN_FROM_FRAME;
      titleY = Math.min(Math.max(desiredY, defaultTitleY), maxAllowedY);
    }

    const fontSize = PLANO_THEME.FONTS.SIZES.H1;
    const titleWidth =
      (pdf.getStringUnitWidth(title) * fontSize) / pdf.internal.scaleFactor;

    // Fila de escala debajo del título (a pedido, ej. "ESCALA: 1/200"),
    // separada por una línea horizontal — mismo recuadro, más alto.
    const escalaText = escalaValue ? `ESCALA: 1/${escalaValue}` : null;
    const escalaFontSize = PLANO_THEME.FONTS.SIZES.BODY;
    const escalaRowHeight = escalaText ? 6 : 0;
    const escalaWidth = escalaText
      ? (pdf.getStringUnitWidth(escalaText) * escalaFontSize) /
        pdf.internal.scaleFactor
      : 0;

    const boxWidth =
      Math.max(titleWidth, escalaWidth) + TITULO.PADDING_H * 2;
    const boxHeight = TITULO.BOX_HEIGHT + escalaRowHeight;
    const boxX = centerX - boxWidth / 2;
    const boxY = titleY - TITULO.PADDING_V;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(boxX, boxY, boxWidth, boxHeight, "FD");

    pdf.setFontSize(fontSize);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, centerX, titleY, { align: "center" });

    if (escalaText) {
      const dividerY = boxY + TITULO.BOX_HEIGHT;
      pdf.line(boxX, dividerY, boxX + boxWidth, dividerY);

      pdf.setFontSize(escalaFontSize);
      pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
      pdf.text(
        escalaText,
        boxX + TITULO.PADDING_H,
        dividerY + escalaRowHeight / 2 + 1.5,
      );
    }
  }

  private drawNorthCatastro(pdf: jsPDF, x: number, y: number, s: number): void {
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.NORTH_ARROW);

    pdf.setFillColor(0, 0, 0);
    pdf.triangle(x, y - s / 2, x - s / 6, y, x + s / 6, y, "F");

    pdf.setFillColor(255, 255, 255);
    pdf.triangle(x, y + s / 2, x - s / 6, y, x + s / 6, y, "FD");

    pdf.line(x, y - s / 2, x, y + s / 2);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(s);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text("N", x, y - s / 2 - 2, { align: "center" });
  }

  private calculateScaleForViewport(
    vertices: [number, number][],
    w: number,
    h: number,
    m: number,
  ): EscalaCalculada {
    const bbox = getBoundingBox(vertices);
    const scaleX = (bbox.width * 1000) / (w - m * 2);
    const scaleY = (bbox.height * 1000) / (h - m * 2);
    // ZOOM_OUT_PADDING: antes el lote se ajustaba al 100% exacto del área
    // disponible (ajuste "a presión"), lo que lo hacía ver grande/apretado
    // contra el marco. 1.15 deja ~15% de aire extra alrededor, así el lote
    // sale un poco más pequeño y con más contexto visible sin tocar el
    // recuadro. En esta copia se pidió alejar un 30% adicional, así que se
    // multiplica: 1.15 * 1.30 ≈ 1.495 (solo afecta a esta copia, no al
    // Plano Perimétrico oficial).
    const ZOOM_OUT_PADDING = 1.15 * 1.3;
    const raw = Math.max(scaleX, scaleY) * ZOOM_OUT_PADDING;

    const scales = [
      50, 75, 100, 125, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000,
    ];
    const final = scales.find((s) => s >= raw) || Math.ceil(raw / 100) * 100;

    return { escala: final, escalaTexto: `1 / ${final} ` };
  }

  private calculatePoleOfInaccessibility(pts: [number, number][]): {
    x: number;
    y: number;
  } {
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
      console.warn("Error verificando punto en polígono:", error);
    }

    // 3. Fallback: Si el centroide está fuera (ej. lote en U), usar centro del bounding box
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    pts.forEach((p) => {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });

    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }

  private calculateVisualCenter(pts: [number, number][]): {
    x: number;
    y: number;
  } {
    let sx = 0,
      sy = 0;
    pts.forEach((p) => {
      sx += p[0];
      sy += p[1];
    });
    return { x: sx / pts.length, y: sy / pts.length };
  }

  private getBoundingBoxFromCoords(coords: [number, number][]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } {
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    coords.forEach(([x, y]) => {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    return { minX, maxX, minY, maxY };
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const cleanHex = hex.replace("#", "");
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
    initialSize: number = PLANO_THEME.FONTS.SIZES.BODY,
  ): void {
    let currentSize = initialSize;
    const minSize = PLANO_THEME.FONTS.SIZES.TINY;

    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(currentSize);

    while (
      (pdf.getStringUnitWidth(text) * currentSize) / pdf.internal.scaleFactor >
        maxWidth &&
      currentSize > minSize
    ) {
      currentSize -= 0.5;
      pdf.setFontSize(currentSize);
    }

    let finalText = text;
    const textWidth =
      (pdf.getStringUnitWidth(text) * currentSize) / pdf.internal.scaleFactor;
    if (textWidth > maxWidth) {
      while (
        (pdf.getStringUnitWidth(finalText + "...") * currentSize) /
          pdf.internal.scaleFactor >
          maxWidth &&
        finalText.length > 0
      ) {
        finalText = finalText.slice(0, -1);
      }
      finalText += "...";
    }

    pdf.text(finalText, x, y);
  }

  /**
   * Dibuja un placeholder para el logo cuando falla la carga
   */
  private drawLogoPlaceholder(
    pdf: jsPDF,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.H1);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text("LOGO", x + w / 2, y + h / 2 - 2, { align: "center" });
  }
}
