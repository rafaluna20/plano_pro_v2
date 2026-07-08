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
    this.drawTitle(pdf, layout.drawingArea, "PLANO PERIMÉTRICO", paperPoints);
    this.drawNorthCatastro(
      pdf,
      layout.drawingArea.x +
        layout.drawingArea.width -
        PLANO_THEME.NORTE.OFFSET_X,
      layout.drawingArea.y + PLANO_THEME.NORTE.OFFSET_Y,
      PLANO_THEME.NORTE.SIZE,
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
    const membreteHeight = LAYOUT.ALTURAS.MEMBRETE;

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
    const { UBICACION } = PLANO_THEME;

    // 1. Header y Marco
    this.drawLocationHeader(pdf, area);

    const headerH = UBICACION.HEADER_HEIGHT;
    const drawX = area.x + 0.5;
    const drawY = area.y + headerH + 0.5;
    const drawW = area.width - 1;
    const drawH = area.height - headerH - 1;

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

    pdf.setFontSize(6);
    pdf.setTextColor(0);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(
      `(E Aprox 1:${escalaNominal})`,
      area.x + area.width - 2,
      area.y + 3.5,
      { align: "right" },
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

      // Etiquetas de vecinos
      if (!isCalle && feature.properties.numeroLote) {
        const center = this.calculateVisualCenter(pts);
        pdf.setFontSize(4);
        pdf.setTextColor(100);
        pdf.text(feature.properties.numeroLote, center.x, center.y, {
          align: "center",
        });
      }
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

  private drawLocationHeader(pdf: jsPDF, area: AreaDibujo) {
    const { UBICACION } = PLANO_THEME;
    // Marco exterior
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(area.x, area.y, area.width, area.height);

    // Barra de título
    pdf.setFillColor(
      this.colorCache.header.r,
      this.colorCache.header.g,
      this.colorCache.header.b,
    );
    pdf.rect(area.x, area.y, area.width, UBICACION.HEADER_HEIGHT, "F");

    // Texto
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text("CROQUIS DE UBICACIÓN", area.x + area.width / 2, area.y + 3.5, {
      align: "center",
    });
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
    const { TABLA_TECNICA } = PLANO_THEME;
    const { x, y: startY, width: w } = area;
    let y = startY;

    // Header
    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, y, w, TABLA_TECNICA.HEADER_HEIGHT, "F");
    pdf.setTextColor(255);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text("CUADRO DE DATOS TÉCNICOS (WGS84)", x + w / 2, y + 4, {
      align: "center",
    });
    y += TABLA_TECNICA.HEADER_HEIGHT;

    // Sub-header - Con columnas: VERT, LADO, DIST, ANG, COLINDANCIA, ESTE, NORTE
    const cols = [
      "V.",
      "LADO",
      "DIST.",
      "ANG.",
      "COLINDANCIA",
      "ESTE (X)",
      "NORTE (Y)",
    ];
    // Ajuste de anchos: DIST y ANG +30% (aprox). V, ESTE, NORTE reducidos para compensar.
    const colW = [6, 10, 14, 13, 19, 20, 20].map((p) => (w * p) / 100);

    const headerColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER);
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.setDrawColor(0);
    pdf.rect(x, y, w, TABLA_TECNICA.SUBHEADER_HEIGHT, "FD");
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

    let cx = x;
    cols.forEach((c: string, i: number) => {
      pdf.text(c, cx + colW[i] / 2, y + 3.5, { align: "center" });
      // Linea vertical (separador derecho)
      pdf.line(
        cx + colW[i],
        y,
        cx + colW[i],
        y + TABLA_TECNICA.SUBHEADER_HEIGHT,
      );
      cx += colW[i];
    });
    y += TABLA_TECNICA.SUBHEADER_HEIGHT;

    // Filas de datos (USANDO LINDEROS PROCESADOS)
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

    // Ángulos internos: única fuente de verdad (lib/geometry/utmUtils),
    // robusta ante el sentido de recorrido del polígono.
    const angulosInternos = calculateInteriorAngles(vertices);

    let totalLength = 0;
    let totalAngle = 0;

    const toDMS = (deg: number): string => {
      let d = Math.floor(deg);
      let mFloat = (deg - d) * 60;
      let m = Math.floor(mFloat);
      let s = Math.round((mFloat - m) * 60);

      if (s === 60) {
        s = 0;
        m++;
      }
      if (m === 60) {
        m = 0;
        d++;
      }

      return `${d}°${String(m).padStart(2, "0")}'${String(s).padStart(2, "0")}"`;
    };

    this.datosProcesados.linderosFinal.forEach(
      (lindero: LinderoRegistral, i: number) => {
        // Zebra striping
        if (i % 2 === 0) {
          pdf.setFillColor(255, 255, 255);
        } else {
          const zebraColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_ZEBRA);
          pdf.setFillColor(zebraColor.r, zebraColor.g, zebraColor.b);
        }
        pdf.rect(x, y, w, TABLA_TECNICA.ROW_HEIGHT, "FD");

        cx = x;
        const cellY = y + 3;

        const drawCell = (
          txt: string,
          width: number,
          size: number = PLANO_THEME.FONTS.SIZES.SMALL,
        ) => {
          pdf.setFontSize(size);
          pdf.text(txt, cx + width / 2, cellY, { align: "center" });
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
        drawCell(lindero.longitudTexto + "m", colW[2]);

        // ⭐ MOSTRAR ángulo interno (fuente única: calculateInteriorAngles)
        const angDeg = angulosInternos[vertexIdx];

        totalAngle += angDeg;

        drawCell(toDMS(angDeg), colW[3]);
        // ⭐ MOSTRAR colindanciaTexto
        drawCell(lindero.colindanciaTexto, colW[4], 5); // Fuente más pequeña para colindancia
        drawCell(vertices[vertexIdx][0].toFixed(2), colW[5]);
        drawCell(vertices[vertexIdx][1].toFixed(2), colW[6]);

        y += TABLA_TECNICA.ROW_HEIGHT;
      },
    );

    // DIBUJAR TOTALES
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.rect(x, y, w, TABLA_TECNICA.ROW_HEIGHT, "FD");

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
    pdf.text("TOTAL", x + labelW / 2, y + 3.5, { align: "center" });

    // Suma Distancia
    let cxSum = x + colW[0] + colW[1];
    pdf.text(totalLength.toFixed(2) + "m", cxSum + colW[2] / 2, y + 3.5, {
      align: "center",
    });
    cxSum += colW[2];

    // Suma Angulos
    pdf.text(toDMS(totalAngle), cxSum + colW[3] / 2, y + 3.5, {
      align: "center",
    });

    y += TABLA_TECNICA.ROW_HEIGHT;
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
    this.datosProcesados.linderosFinal.forEach(
      (lindero: LinderoRegistral, i: number) => {
        const p = paperPoints[i];
        const next = paperPoints[(i + 1) % paperPoints.length];
        const mx = (p[0] + next[0]) / 2;
        const my = (p[1] + next[1]) / 2;

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
        const fperpX = -fuy;
        const fperpY = fux;

        const textStr = `${lindero.longitudTexto}m`;
        pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
        pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
        const textWidth = pdf.getTextWidth(textStr);

        // Caja blanca de fondo, rotada igual que el texto (un rect sin rotar
        // quedaría torcido respecto al texto en lados diagonales).
        const halfW = textWidth / 2 + 1;
        const halfH = 2;
        const corners: [number, number][] = [
          [mx - fux * halfW - fperpX * halfH, my - fuy * halfW - fperpY * halfH],
          [mx + fux * halfW - fperpX * halfH, my + fuy * halfW - fperpY * halfH],
          [mx + fux * halfW + fperpX * halfH, my + fuy * halfW + fperpY * halfH],
          [mx - fux * halfW + fperpX * halfH, my - fuy * halfW + fperpY * halfH],
        ];
        cad.drawPolygon(corners, {
          fillColor: PLANO_THEME.COLORS.WHITE,
          strokeColor: PLANO_THEME.COLORS.WHITE,
          lineWidth: 0.01,
        });

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
        const fontHeightMm =
          PLANO_THEME.FONTS.SIZES.SMALL / pdf.internal.scaleFactor;
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
    const { ETIQUETA_CENTRAL } = PLANO_THEME;
    const center = this.calculatePoleOfInaccessibility(paperPoints);

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
    pdf.rect(
      center.x - ETIQUETA_CENTRAL.WIDTH / 2,
      center.y - ETIQUETA_CENTRAL.HEIGHT / 2,
      ETIQUETA_CENTRAL.WIDTH,
      ETIQUETA_CENTRAL.HEIGHT,
      "FD",
    );

    const loteProps = this.payload.loteObjetivo.properties;

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setTextColor(0);
    pdf.text(`LOTE ${loteProps.identificador.lote}`, center.x, center.y - 2, {
      align: "center",
    });

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

    // ⭐ USAR datos procesados (registral > calculado)
    // Recalcular perímetro suma visual para coincidencia exacta
    const perimetroVisual = this.datosProcesados.linderosFinal.reduce(
      (sum, l) => sum + parseFloat(l.longitudTexto),
      0,
    );

    pdf.text(
      `A = ${this.datosProcesados.areaFinal.toFixed(2)} m²`,
      center.x,
      center.y + 1,
      { align: "center" },
    );
    pdf.text(
      `P = ${perimetroVisual.toFixed(2)} ml`,
      center.x,
      center.y + ETIQUETA_CENTRAL.LINE_SPACING,
      { align: "center" },
    );
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
    pdf.text("PP-01", splitX + codeAreaW / 2 + 1, y + 9, { align: "center" });

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
    const { x, y, width: w, height: h } = area;
    const { MEMBRETE } = PLANO_THEME;

    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    pdf.rect(x, y, w, h);

    const colSplit = w * MEMBRETE.LOGO_COLUMN_PERCENT;
    pdf.line(x + colSplit, y, x + colSplit, y + h);

    // Logo
    const logoUrl = this.payload.configImpresion?.logoUrl;

    if (logoUrl) {
      try {
        const res = await fetch(logoUrl);
        if (!res.ok) throw new Error(`Fetch failed: ${res.statusText}`);
        const buffer = await res.arrayBuffer();
        const data = new Uint8Array(buffer);
        const contentType = res.headers.get("content-type") || "";
        const format = contentType.includes("png") ? "PNG" : "JPEG";
        pdf.addImage(
          data,
          format,
          x + 10,
          y + 2,
          colSplit - 20,
          h - 30,
          undefined,
          "FAST",
        );

        // pdf.rect(x + 5, y + 5, colSplit - 10, h - 10);
      } catch (err) {
        console.warn("Fallo al cargar logoUrl:", err);
        this.drawLogoPlaceholder(pdf, x, y, colSplit, h);
      }
    } else {
      this.drawLogoPlaceholder(pdf, x, y, colSplit, h);
    }

    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.LABEL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text("EMPRESA / ING.", x + colSplit / 2, y + h / 2 + 4, {
      align: "center",
    });

    const startX = x + colSplit + MEMBRETE.PADDING_H;
    const lineHeight = h / MEMBRETE.NUM_FILAS;

    const loteProps = this.payload.loteObjetivo.properties;

    const drawRow = (idx: number, label: string, val: string) => {
      const rowY = y + idx * lineHeight;
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
      this.drawTextAutoFit(
        pdf,
        val || "---",
        startX,
        rowY + 8,
        w - colSplit - MEMBRETE.PADDING_H * 2,
        PLANO_THEME.FONTS.SIZES.BODY,
      );
    };

    drawRow(
      0,
      "PROYECTO:",
      loteProps.identificador.urbanizacion || "LEVANTAMIENTO TOPOGRÁFICO",
    );
    drawRow(1, "PROPIETARIO:", loteProps.titularidad?.nombre || "---");
    drawRow(
      2,
      "UBICACIÓN:",
      `Mz. ${
        loteProps.identificador.manzana
      } Lt.${loteProps.identificador.lote} `,
    );

    // Área y Perímetro
    const rowY4 = y + 3 * lineHeight;
    const grayVal = parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16);
    pdf.setDrawColor(grayVal);
    pdf.line(x + colSplit, rowY4, x + w, rowY4);

    const dimmedVal = parseInt(PLANO_THEME.COLORS.DIMMED.slice(1, 3), 16);
    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text("ÁREA:", startX, rowY4 + 3.5);
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(
      `${this.datosProcesados.areaFinal.toFixed(2)} m²`,
      startX,
      rowY4 + 8,
    );

    const midX = startX + 30;
    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text("PERÍMETRO:", midX, rowY4 + 3.5);
    pdf.setTextColor(0);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(
      `${this.datosProcesados.perimetroFinal.toFixed(2)} ml`,
      midX,
      rowY4 + 8,
    );

    // Escala y Fecha
    const rowY5 = y + 4 * lineHeight;
    pdf.setDrawColor(grayVal);
    pdf.line(x + colSplit, rowY5, x + w, rowY5);

    pdf.setTextColor(dimmedVal);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.text("ESCALA:", startX, rowY5 + 3.5);
    pdf.text("FECHA:", midX, rowY5 + 3.5);

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

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.FRAME_INNER);
    const fontSize = PLANO_THEME.FONTS.SIZES.H1;
    const titleWidth =
      (pdf.getStringUnitWidth(title) * fontSize) / pdf.internal.scaleFactor;
    pdf.rect(
      centerX - titleWidth / 2 - TITULO.PADDING_H,
      titleY - TITULO.PADDING_V,
      titleWidth + TITULO.PADDING_H * 2,
      TITULO.BOX_HEIGHT,
      "FD",
    );

    pdf.setFontSize(fontSize);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setTextColor(0, 0, 0);
    pdf.text(title, centerX, titleY, { align: "center" });
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
    const raw = Math.max(scaleX, scaleY);

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
