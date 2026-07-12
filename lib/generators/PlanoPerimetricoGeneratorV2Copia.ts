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
  toDMS,
} from "@/lib/geometry/utmUtils";
import { MapService } from "@/lib/services/MapService";
import { PLANO_THEME, getGridInterval } from "@/lib/config/PlanoTheme";
import type {
  PlanoPayloadHibrido,
  LinderoRegistral,
} from "@/types/PlanosPayload";
import type { DatosProcesados } from "@/lib/services/PlanoDataProcessor";

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

  /**
   * Vértices REALES del lote (un punto por esquina), sin los puntos
   * intermedios que PlanoRequestAdapter muestrea sobre cada lado curvo (ver
   * misma nota en PlanoPerimetricoGeneratorV2.ts).
   */
  private getVerticesOriginalesUTM(fallback: [number, number][]): [number, number][] {
    const raw = (this.payload.loteObjetivo.properties as any).verticesOriginales as
      | [number, number][]
      | undefined;
    if (!raw || raw.length < 3) return fallback;
    const cerrado =
      raw[0][0] === raw[raw.length - 1][0] && raw[0][1] === raw[raw.length - 1][1];
    return cerrado ? raw.slice(0, -1) : raw;
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

    // Vértices REALES (un punto por esquina), en el mismo sistema de
    // referencia que el resto del dibujo — ver getVerticesOriginalesUTM.
    const utmVerticesOriginales = this.getVerticesOriginalesUTM(utmVertices);
    const paperPointsOriginales = utmToPaperRelative(
      utmVerticesOriginales,
      centroUtm,
      escalaMain.escala,
      centerX,
      centerY,
    );

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

    // D. (Etiqueta Central movida fuera del plano — ver drawTechnicalTableHybrid,
    // ahora se dibuja debajo del "CUADRO DE DATOS TÉCNICOS")

    // E. Datos Topográficos (Cotas con texto REGISTRAL, Vértices, Ángulos)
    this.drawVerticesAndDimensions(pdf, paperPointsOriginales, cad);

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
    const finalYTablaTecnica = this.drawTechnicalTableHybrid(
      pdf,
      layout.technicalTableArea,
      utmVerticesOriginales,
    );

    // 3b. Área / Perímetro, debajo del cuadro técnico (antes centrado
    // dentro del polígono del plano principal — ver nota en el método).
    this.drawAreaPerimetroDebajoDeTabla(
      pdf,
      layout.technicalTableArea.x,
      finalYTablaTecnica + 3,
      layout.technicalTableArea.width,
    );

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
    const factorEscala = 1000 / escala;
    const utmAPapel = (coord: [number, number]): [number, number] => {
      const dx = (coord[0] - centroUtm[0]) * factorEscala;
      const dy = (coord[1] - centroUtm[1]) * factorEscala;
      return [centerX + dx, centerY - dy];
    };

    // Renderizar features del contexto
    this.payload.contexto.features.forEach((feature) => {
      // Elemento circular completo (glorieta, plaza redonda, reservorio):
      // se dibuja como círculo real, no como el polígono-diamante que trae
      // geometry.coordinates solo para fines de encuadre/bbox.
      if (feature.properties.circulo) {
        const [cx, cy] = utmAPapel(feature.properties.circulo.centro);
        const radioPapel = feature.properties.circulo.radio * factorEscala;
        const colorUrbano =
          feature.properties.color || PLANO_THEME.ELEMENTO_URBANO_FALLBACK_COLOR;
        cad.drawCircle(cx, cy, radioPapel, {
          strokeColor: colorUrbano,
          fillColor: colorUrbano,
          lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
        });
        if (feature.properties.mostrarEtiqueta !== false && feature.properties.numeroLote) {
          pdf.setTextColor(parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16));
          pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
          pdf.text(feature.properties.numeroLote, cx, cy, { align: "center" });
        }
        return;
      }

      if (feature.geometry.type !== "Polygon") return;

      const coords = feature.geometry.coordinates[0] as [number, number][];
      const paperPoints = coords.map(utmAPapel);

      // Diferenciar entre elementos urbanos (capa dinámica definida en Odoo
      // — elemento.urbano.capa, estilo AutoCAD: trae su propio color/
      // mostrarEtiqueta/esArea) y lotes vecinos comunes ("lote" es el único
      // tipo reservado, sin color propio).
      if (feature.properties.tipo !== "lote") {
        const colorUrbano =
          feature.properties.color || PLANO_THEME.ELEMENTO_URBANO_FALLBACK_COLOR;

        if (feature.properties.esArea === false) {
          cad.drawPolyline(paperPoints, {
            strokeColor: colorUrbano,
            lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
          });
        } else {
          cad.drawPolygon(paperPoints, {
            strokeColor: colorUrbano,
            lineWidth: PLANO_THEME.STROKES.NEIGHBOR,
            fillColor: colorUrbano,
          });
        }

        if (feature.properties.mostrarEtiqueta !== false && feature.properties.numeroLote) {
          const center = this.calculateVisualCenter(paperPoints);
          pdf.setTextColor(
            parseInt(PLANO_THEME.COLORS.GRID_LINE.slice(1, 3), 16),
          );
          pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
          pdf.text(feature.properties.numeroLote, center.x, center.y, {
            align: "center",
          });
        }
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

    // Escala calculada UNA sola vez, fuera de los modos (vectorial/
    // satelital/imagen): antes vivía solo dentro de renderVectorLocationSketch,
    // así que la leyenda "ESCALA: 1/N" debajo de "PLANO DE LOCALIZACIÓN"
    // nunca se dibujaba cuando el modo satelital/imagen lograba cargar su
    // propia imagen (esas ramas no llaman a renderVectorLocationSketch).
    const escalaNominalCroquis = this.calculateEscalaCroquis(
      mainVertices,
      drawW,
      drawH,
    );

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
                escalaNominalCroquis,
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
              escalaNominalCroquis,
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
            escalaNominalCroquis,
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
              escalaNominalCroquis,
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
            escalaNominalCroquis,
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
          escalaNominalCroquis,
        );
      }
    } finally {
      pdf.restoreGraphicsState();
    }

    // Offset X aumentado (antes -8) para dar lugar a las etiquetas E/W de
    // la nueva rosa vectorial de 8 puntas, que ocupa más ancho que la
    // flecha simple anterior.
    this.drawNorthCatastro(pdf, area.x + area.width - 15, area.y + 15, 8);

    // Leyenda de escala, debajo del nombre "PLANO DE LOCALIZACIÓN" (ver
    // drawLocationHeader) — se dibuja SIEMPRE, sin importar qué modo haya
    // renderizado el mapa arriba.
    const frameHeightCaption = this.getUbicacionFrameHeight(area);
    pdf.setFontSize(6);
    pdf.setTextColor(0);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text(
      `ESCALA: 1/${escalaNominalCroquis}`,
      area.x + area.width / 2,
      area.y + frameHeightCaption + 7.5,
      { align: "center" },
    );
  }

  /**
   * Renderizado vectorial clásico del croquis (Extraído de drawLocationPlanAutoScale)
   */
  /**
   * Escala nominal "1:N" del croquis, calculada a partir del bbox del lote +
   * contexto disponible. Extraída de renderVectorLocationSketch para que se
   * pueda calcular UNA vez, sin importar qué modo (vectorial/satelital/
   * imagen) termine dibujando el mapa — antes solo existía dentro del modo
   * vectorial, así que la leyenda "ESCALA: 1/N" no se dibujaba cuando el
   * modo satelital/imagen lograba cargar su propia imagen.
   */
  private calculateEscalaCroquis(
    mainVertices: [number, number][],
    drawW: number,
    drawH: number,
  ): number {
    const { UBICACION } = PLANO_THEME;
    const CONTEXT_VISIBLE_FRACTION = 0.72;

    const validCoords: [number, number][] = [...mainVertices];
    if (this.payload.contexto && this.payload.contexto.features) {
      this.payload.contexto.features.forEach((f) => {
        if (f.geometry.type === "Polygon") {
          validCoords.push(
            ...(f.geometry.coordinates[0] as [number, number][]),
          );
        }
      });
    }

    const bbox = getBoundingBox(validCoords);
    const contentW = bbox.width || 50;
    const contentH = bbox.height || 50;
    const marginFactor = UBICACION.MARGIN_FACTOR;

    const rawScaleNecesaria = Math.min(
      (drawW * marginFactor) / (contentW * CONTEXT_VISIBLE_FRACTION),
      (drawH * marginFactor) / (contentH * CONTEXT_VISIBLE_FRACTION),
    );
    const nominalNecesario = 1000 / Math.max(rawScaleNecesaria, 0.0001);

    const ESCALAS_ESTANDAR = [100, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000, 7500, 10000];
    return (
      ESCALAS_ESTANDAR.find((s) => s >= nominalNecesario) ??
      Math.ceil(nominalNecesario / 500) * 500
    );
  }

  private renderVectorLocationSketch(
    pdf: jsPDF,
    drawX: number,
    drawY: number,
    drawW: number,
    drawH: number,
    mainVertices: [number, number][],
    area: AreaDibujo,
    escalaNominal: number,
  ): void {
    const { UBICACION } = PLANO_THEME;

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

    // 3. BBox (la escala ya viene calculada por calculateEscalaCroquis)
    const bbox = getBoundingBox(validCoords);
    const rawScale = 1000 / escalaNominal;

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

      // Elemento urbano (capa dinámica de Odoo, trae su propio color) vs.
      // lote vecino común ("lote" es el único tipo reservado).
      if (feature.properties.tipo !== "lote") {
        const colorUrbano =
          feature.properties.color || PLANO_THEME.ELEMENTO_URBANO_FALLBACK_COLOR;
        const rgb = this.hexToRgb(colorUrbano);
        pdf.setDrawColor(rgb.r, rgb.g, rgb.b);
        pdf.setLineWidth(UBICACION.VECINO_LINE_WIDTH);
        pdf.setFillColor(rgb.r, rgb.g, rgb.b);
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
   * Dibuja cuadro técnico usando datos procesados (REGISTRAL > CALCULADO).
   * A diferencia del Plano Perimétrico oficial y la Memoria Descriptiva
   * (que comparten lib/generators/CoordinatesTable.ts), esta copia NO
   * muestra las columnas ESTE (X) / NORTE (Y) — a pedido, solo en esta
   * copia. Por eso implementa su propia tabla en vez de usar la función
   * compartida.
   */
  private drawTechnicalTableHybrid(
    pdf: jsPDF,
    area: AreaDibujo,
    vertices: [number, number][],
  ): number {
    const { TABLA_TECNICA } = PLANO_THEME;
    const { x, width } = area;
    let cy = area.y;

    // Título
    pdf.setFillColor(0, 0, 0);
    pdf.rect(x, cy, width, TABLA_TECNICA.HEADER_HEIGHT, "F");
    pdf.setTextColor(255);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.BODY);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.text("CUADRO DE DATOS TÉCNICOS (WGS84)", x + width / 2, cy + 4, {
      align: "center",
    });
    cy += TABLA_TECNICA.HEADER_HEIGHT;

    // Sub-header: solo V. / LADO / DIST. / ANG. (sin ESTE/NORTE)
    const cols = ["V.", "LADO", "DIST.", "ANG."];
    const colW = [13, 23, 33, 31].map((p) => (width * p) / 100);
    const headerColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_HEADER);

    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.setDrawColor(0);
    pdf.rect(x, cy, width, TABLA_TECNICA.SUBHEADER_HEIGHT, "FD");
    pdf.setTextColor(0);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

    let cx = x;
    cols.forEach((c, i) => {
      pdf.text(c, cx + colW[i] / 2, cy + 3.5, { align: "center" });
      pdf.line(cx + colW[i], cy, cx + colW[i], cy + TABLA_TECNICA.SUBHEADER_HEIGHT);
      cx += colW[i];
    });
    cy += TABLA_TECNICA.SUBHEADER_HEIGHT;

    // Filas de datos
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);

    const angulosInternos = calculateInteriorAngles(vertices);
    const linderoPorVertice = new Map(
      this.datosProcesados.linderosFinal.map((l) => [l.index, l]),
    );
    const zebraColor = this.hexToRgb(PLANO_THEME.COLORS.TABLE_ZEBRA);

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
      pdf.rect(x, cy, width, TABLA_TECNICA.ROW_HEIGHT, "FD");

      pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);

      const lenVal = lindero ? parseFloat(lindero.longitudTexto) : 0;
      totalLength += isNaN(lenVal) ? 0 : lenVal;
      const angDeg = angulosInternos[i];
      totalAngle += angDeg;

      const values = [
        `V${i + 1}`,
        lindero?.tramo ?? `V${i + 1} - V${next + 1}`,
        lindero ? `${lindero.longitudTexto}m` : "---",
        toDMS(angDeg),
      ];

      cx = x;
      values.forEach((val, j) => {
        pdf.text(val, cx + colW[j] / 2, cy + 3, { align: "center" });
        pdf.line(cx + colW[j], cy, cx + colW[j], cy + TABLA_TECNICA.ROW_HEIGHT);
        cx += colW[j];
      });

      cy += TABLA_TECNICA.ROW_HEIGHT;
    });

    // Fila TOTAL
    pdf.setFillColor(headerColor.r, headerColor.g, headerColor.b);
    pdf.rect(x, cy, width, TABLA_TECNICA.ROW_HEIGHT, "FD");
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(PLANO_THEME.FONTS.SIZES.SMALL);
    pdf.setTextColor(0);

    const labelW = colW[0] + colW[1];
    pdf.text("TOTAL", x + labelW / 2, cy + 3, { align: "center" });

    let cxSum = x + labelW;
    pdf.text(totalLength.toFixed(2) + "m", cxSum + colW[2] / 2, cy + 3, {
      align: "center",
    });
    cxSum += colW[2];
    pdf.text(toDMS(totalAngle), cxSum + colW[3] / 2, cy + 3, {
      align: "center",
    });
    cy += TABLA_TECNICA.ROW_HEIGHT;

    // Borde exterior
    pdf.setDrawColor(0);
    pdf.rect(x, area.y, width, cy - area.y);

    return cy;
  }

  /**
   * Información de LOTE / Área / Perímetro, antes centrada dentro del
   * polígono del plano principal (drawPolygonCentralData) — a pedido, se
   * saca de ahí y se dibuja aquí, debajo del "CUADRO DE DATOS TÉCNICOS".
   */
  private drawAreaPerimetroDebajoDeTabla(
    pdf: jsPDF,
    x: number,
    y: number,
    width: number,
  ): void {
    const loteProps = this.payload.loteObjetivo.properties;
    const perimetroVisual = this.datosProcesados.linderosFinal.reduce(
      (sum, l) => sum + parseFloat(l.longitudTexto),
      0,
    );
    const loteText = `LOTE ${loteProps.identificador.lote}`;
    const areaText = `A = ${this.datosProcesados.areaFinal.toFixed(2)} m²`;
    const perimText = `P = ${perimetroVisual.toFixed(2)} ml`;

    const LOTE_FONT = PLANO_THEME.FONTS.SIZES.BODY;
    const AREA_PERIMETRO_FONT = PLANO_THEME.FONTS.SIZES.SMALL * 1.5;
    const rowGap = 5.25; // mismo espaciado ya usado antes para estas líneas

    const centerX = x + width / 2;
    const loteY = y + 4;
    const areaY = loteY + rowGap;
    const perimY = areaY + rowGap;
    const boxHeight = perimY - loteY + 6;

    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.GRID);
    pdf.rect(x, y, width, boxHeight, "FD");

    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    pdf.setFontSize(LOTE_FONT);
    pdf.setTextColor(0);
    pdf.text(loteText, centerX, loteY, { align: "center" });

    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.NORMAL);
    pdf.setFontSize(AREA_PERIMETRO_FONT);
    pdf.text(areaText, centerX, areaY, { align: "center" });
    pdf.text(perimText, centerX, perimY, { align: "center" });
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

        const textStr = lindero.esArco
          ? `Arco R=${lindero.radioArco?.toFixed(2)}m L=${lindero.longitudTexto}m`
          : `${lindero.longitudTexto}m`;
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

    // Recuadro anclado en la parte IZQUIERDA del área de dibujo (a pedido),
    // en vez de centrado horizontalmente como antes.
    const LEFT_MARGIN = 4; // mm desde el borde izquierdo del recuadro
    const boxX = area.x + LEFT_MARGIN;
    const centerX = boxX + boxWidth / 2; // centrado del texto DENTRO de la caja
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

  /**
   * Rosa de los vientos vectorial de 8 puntas (N/E/S/W largas en las
   * cardinales, más cortas en las diagonales, círculo blanco al centro) — a
   * pedido, en reemplazo de la flecha simple anterior (2 triángulos + "N").
   * Todo dibujado con primitivas de jsPDF, sin imagen.
   */
  private drawNorthCatastro(pdf: jsPDF, x: number, y: number, s: number): void {
    const R_LONG = s / 2;
    const R_SHORT = R_LONG * 0.45;
    const BASE_WIDTH_LONG = R_LONG * 0.28;
    const BASE_WIDTH_SHORT = R_SHORT * 0.28;

    // Cada punta es una "cometa" partida en 2 triángulos (negro/gris) desde
    // el centro hasta la punta, dando el efecto pinwheel clásico de una
    // rosa de los vientos. Ángulos en el espacio mm expuesto por jsPDF:
    // 90°=N (arriba), 0°=E (derecha), misma convención (cos, -sin) que el
    // resto del documento.
    const drawSpike = (angleDeg: number, length: number, baseWidth: number) => {
      const angleRad = (angleDeg * Math.PI) / 180;
      const dirX = Math.cos(angleRad);
      const dirY = -Math.sin(angleRad);
      const perpX = -dirY;
      const perpY = dirX;

      const tipX = x + dirX * length;
      const tipY = y + dirY * length;
      const baseLeftX = x + perpX * baseWidth;
      const baseLeftY = y + perpY * baseWidth;
      const baseRightX = x - perpX * baseWidth;
      const baseRightY = y - perpY * baseWidth;

      pdf.setDrawColor(0);
      pdf.setLineWidth(PLANO_THEME.STROKES.NORTH_ARROW);

      pdf.setFillColor(0, 0, 0);
      pdf.triangle(x, y, baseLeftX, baseLeftY, tipX, tipY, "FD");

      pdf.setFillColor(150, 150, 150);
      pdf.triangle(x, y, tipX, tipY, baseRightX, baseRightY, "FD");
    };

    drawSpike(90, R_LONG, BASE_WIDTH_LONG); // N
    drawSpike(45, R_SHORT, BASE_WIDTH_SHORT); // NE
    drawSpike(0, R_LONG, BASE_WIDTH_LONG); // E
    drawSpike(315, R_SHORT, BASE_WIDTH_SHORT); // SE
    drawSpike(270, R_LONG, BASE_WIDTH_LONG); // S
    drawSpike(225, R_SHORT, BASE_WIDTH_SHORT); // SW
    drawSpike(180, R_LONG, BASE_WIDTH_LONG); // W
    drawSpike(135, R_SHORT, BASE_WIDTH_SHORT); // NW

    // Círculo blanco central
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(0);
    pdf.setLineWidth(PLANO_THEME.STROKES.NORTH_ARROW);
    pdf.circle(x, y, BASE_WIDTH_LONG * 0.9, "FD");

    // Etiquetas cardinales (sin rotación, align/baseline de jsPDF son
    // seguros aquí — el bug de align+angle solo aplica a texto rotado).
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(s);
    pdf.setFont(PLANO_THEME.FONTS.MAIN, PLANO_THEME.FONTS.WEIGHTS.BOLD);
    const labelGap = 2;
    pdf.text("N", x, y - R_LONG - labelGap, { align: "center", baseline: "bottom" });
    pdf.text("S", x, y + R_LONG + labelGap, { align: "center", baseline: "top" });
    pdf.text("E", x + R_LONG + labelGap, y, { align: "left", baseline: "middle" });
    pdf.text("W", x - R_LONG - labelGap, y, { align: "right", baseline: "middle" });
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
    // contra el marco. 1.15 deja ~15% de aire extra alrededor. Se pidieron
    // dos alejamientos adicionales sucesivos en esta copia: +30% y luego
    // +90% más, así que se multiplican todos: 1.15 * 1.30 * 1.90 ≈ 2.8405
    // (solo afecta a esta copia, no al Plano Perimétrico oficial).
    const ZOOM_OUT_PADDING = 1.15 * 1.3 * 1.9;
    const raw = Math.max(scaleX, scaleY) * ZOOM_OUT_PADDING;

    const scales = [
      50, 75, 100, 125, 200, 250, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000,
    ];
    const final = scales.find((s) => s >= raw) || Math.ceil(raw / 100) * 100;

    return { escala: final, escalaTexto: `1 / ${final} ` };
  }

  /**
   * Centroide REAL del polígono (ponderado por área) — ver misma nota en
   * PlanoPerimetricoGeneratorV2.ts. Un promedio ingenuo de vértices arrastra
   * el centro hacia un lado curvo (muestreado con ~16 puntos extra).
   */
  private calculateVisualCenter(pts: [number, number][]): {
    x: number;
    y: number;
  } {
    let areaAcc = 0;
    let cx = 0;
    let cy = 0;
    const n = pts.length;

    for (let i = 0; i < n; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[(i + 1) % n];
      const cross = x0 * y1 - x1 * y0;
      areaAcc += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }

    const area = areaAcc / 2;
    if (Math.abs(area) < 1e-9) {
      let sx = 0,
        sy = 0;
      pts.forEach((p) => {
        sx += p[0];
        sy += p[1];
      });
      return { x: sx / n, y: sy / n };
    }

    return { x: cx / (6 * area), y: cy / (6 * area) };
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
