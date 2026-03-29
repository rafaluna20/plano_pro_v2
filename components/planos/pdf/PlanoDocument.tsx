import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Image,
  Svg,
  Path,
  Circle,
  G,
  Rect,
} from "@react-pdf/renderer";
import DrawingVectorial from "./DrawingVectorial";
import DrawingSatelital from "./DrawingSatelital";
import DrawingImagen from "./DrawingImagen";

interface Point {
  id: string;
  x: number;
  y: number;
}

export interface PlanoDocumentProps {
  modoUbicacion: "vectorial" | "satelital" | "imagen";
  satelliteUrl?: string;
  imagenGeneral?: string;
  logoUrl?: string;
  loteId?: string;
  propietario?: string;
  ubicacion?: string;
  vertices?: Point[];
  lotesAdyacentes?: { id: string; vertices: Point[] }[];
  contexto?: { vecinos: { id: string; nombre: string; vertices: Point[] }[] };
  fecha?: string;
  escala?: string;
  lamina?: string;
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    flexDirection: "row",
  },
  container: {
    width: "100%",
    height: "100%",
    border: "1.5pt solid #000",
    flexDirection: "row",
  },
  drawingArea: {
    flex: 1,
    borderRight: "1pt solid #000",
    padding: 10,
    position: "relative",
    backgroundColor: "#ffffff",
  },
  infoColumn: {
    width: 250,
    flexDirection: "column",
  },
  sectionHeader: {
    backgroundColor: "#000",
    color: "#fff",
    fontSize: 7,
    fontWeight: "bold",
    textAlign: "center",
    paddingVertical: 3,
    marginBottom: 4,
  },
  sectionBox: {
    borderBottom: "1pt solid #000",
    padding: 5,
  },
  table: {
    width: "100%",
    borderTop: "1pt solid #000",
    borderLeft: "1pt solid #000",
    marginTop: 2,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #000",
  },
  tableHeader: {
    backgroundColor: "#e0e0e0",
  },
  tableCell: {
    flex: 1,
    fontSize: 5,
    padding: 2,
    textAlign: "center",
    borderRight: "1pt solid #000",
    justifyContent: "center",
  },
  titleBlock: {
    marginTop: "auto",
    borderTop: "1.5pt solid #000",
  },
  titleBlockRow: {
    flexDirection: "row",
    borderBottom: "1pt solid #000",
    minHeight: 25,
  },
  titleBlockCell: {
    borderRight: "1pt solid #000",
    padding: 3,
    justifyContent: "center",
  },
  label: {
    fontSize: 5,
    color: "#666",
    marginBottom: 1,
    textTransform: "uppercase",
  },
  value: { fontSize: 8, fontWeight: "bold", color: "#000" },
  valueSmall: { fontSize: 7, color: "#000" },
});

const decimalToDMS = (decimal: number) => {
  const d = Math.floor(decimal);
  const m = Math.floor((decimal - d) * 60);
  const s = ((decimal - d) * 60 - m) * 60;
  return `${d}°${m.toString().padStart(2, "0")}'${s.toFixed(0).padStart(2, "0")}"`;
};

const dist = (p1: Point, p2: Point) =>
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const calculatePolygonArea = (vertices: Point[]) => {
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i].x * vertices[j].y;
    area -= vertices[j].x * vertices[i].y;
  }
  return Math.abs(area / 2);
};

const calculatePerimeter = (vertices: Point[]) => {
  return vertices.reduce((acc, curr, i) => {
    const next = vertices[(i + 1) % vertices.length];
    return acc + dist(curr, next);
  }, 0);
};

export const PlanoDocument = ({
  modoUbicacion,
  satelliteUrl,
  imagenGeneral,
  logoUrl,
  loteId = "L-001",
  propietario = "JUAN PEREZ",
  ubicacion = "MIRAFLORES, LIMA",
  vertices: initialVertices,
  lotesAdyacentes = [],
  contexto,
  fecha = new Date().toLocaleDateString("es-PE"),
  escala = "1/100",
  lamina = "P-01",
}: PlanoDocumentProps) => {
  const vertices = initialVertices || [
    { id: "A", x: 280500.0, y: 8660000.0 },
    { id: "B", x: 280540.5, y: 8660010.2 },
    { id: "C", x: 280550.0, y: 8659980.5 },
    { id: "D", x: 280510.0, y: 8659960.0 },
  ];

  const area = calculatePolygonArea(vertices);
  const perimetro = calculatePerimeter(vertices);

  const datosTecnicos = vertices.map((v, i) => {
    const next = vertices[(i + 1) % vertices.length];
    const prev = vertices[(i - 1 + vertices.length) % vertices.length];

    const distancia = dist(v, next);

    const angleToPrev = Math.atan2(prev.y - v.y, prev.x - v.x);
    const angleToNext = Math.atan2(next.y - v.y, next.x - v.x);
    let anguloInterno = (angleToNext - angleToPrev) * (180 / Math.PI);
    if (anguloInterno < 0) anguloInterno += 360;

    return {
      vertice: v.id,
      lado: `${v.id}-${next.id}`,
      dist: distancia.toFixed(2),
      angValue: anguloInterno,
      ang: decimalToDMS(anguloInterno),
      este: v.x.toFixed(2),
      norte: v.y.toFixed(2),
    };
  });

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={styles.page}>
        <View style={styles.container}>
          <View style={styles.drawingArea}>
            {modoUbicacion === "vectorial" && (
              <DrawingVectorial
                vertices={vertices}
                datosTecnicos={datosTecnicos}
                area={area}
                perimetro={perimetro}
                lotesAdyacentes={lotesAdyacentes}
                contexto={contexto}
              />
            )}
            {modoUbicacion === "satelital" && (
              <DrawingSatelital imageUrl={satelliteUrl || ""} />
            )}
            {modoUbicacion === "imagen" && (
              <DrawingImagen imageUrl={imagenGeneral || ""} />
            )}
            <View style={{ position: "absolute", bottom: 10, left: 10 }}>
              <Text style={{ fontSize: 6, color: "#666" }}>
                PROYECCIÓN: UTM WGS84 - ZONA 18S
              </Text>
            </View>
          </View>

          <View style={styles.infoColumn}>
            <View
              style={[
                styles.sectionBox,
                {
                  height: 140,
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                },
              ]}
            >
              <Text
                style={[
                  styles.sectionHeader,
                  { width: "100%", marginBottom: 0 },
                ]}
              >
                UBICACIÓN ESQUEMÁTICA
              </Text>
              <View
                style={{
                  flex: 1,
                  width: "100%",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {modoUbicacion === "satelital" && satelliteUrl ? (
                  <Image
                    src={satelliteUrl}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <View
                    style={{
                      width: "100%",
                      height: "100%",
                      backgroundColor: "#f9f9f9",
                      padding: 5,
                    }}
                  >
                    <LocationSketchMini
                      vertices={vertices}
                      lotesAdyacentes={lotesAdyacentes}
                      contexto={contexto}
                    />
                  </View>
                )}
              </View>
              <View
                style={{
                  borderTop: "0.5pt solid #000",
                  width: "100%",
                  paddingVertical: 2,
                }}
              >
                <Text style={{ fontSize: 5, textAlign: "center" }}>
                  SIN ESCALA
                </Text>
              </View>
            </View>

            <View style={[styles.sectionBox, { flex: 1 }]}>
              <Text style={styles.sectionHeader}>CUADRO DE DATOS TÉCNICOS</Text>
              <Text
                style={{ fontSize: 5, textAlign: "center", marginBottom: 2 }}
              >
                DATUM WGS84
              </Text>

              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, { width: "10%" }]}>V</Text>
                  <Text style={[styles.tableCell, { width: "15%" }]}>LADO</Text>
                  <Text style={[styles.tableCell, { width: "15%" }]}>DIST</Text>
                  <Text style={[styles.tableCell, { width: "20%" }]}>ANG</Text>
                  <Text style={[styles.tableCell, { width: "20%" }]}>ESTE</Text>
                  <Text
                    style={[styles.tableCell, { width: "20%", borderRight: 0 }]}
                  >
                    NORTE
                  </Text>
                </View>

                {datosTecnicos.map((row, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "10%", fontWeight: "bold" },
                      ]}
                    >
                      {row.vertice}
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%" }]}>
                      {row.lado}
                    </Text>
                    <Text style={[styles.tableCell, { width: "15%" }]}>
                      {row.dist}
                    </Text>
                    <Text
                      style={[styles.tableCell, { width: "20%", fontSize: 4 }]}
                    >
                      {row.ang}
                    </Text>
                    <Text style={[styles.tableCell, { width: "20%" }]}>
                      {row.este}
                    </Text>
                    <Text
                      style={[
                        styles.tableCell,
                        { width: "20%", borderRight: 0 },
                      ]}
                    >
                      {row.norte}
                    </Text>
                  </View>
                ))}
              </View>

              <View
                style={{ marginTop: 5, padding: 5, backgroundColor: "#f0f0f0" }}
              >
                <Text style={{ fontSize: 6, fontWeight: "bold" }}>
                  ÁREA: {area.toFixed(2)} m²
                </Text>
                <Text style={{ fontSize: 6, fontWeight: "bold" }}>
                  PERÍMETRO: {perimetro.toFixed(2)} ml
                </Text>
              </View>
            </View>

            <View style={styles.titleBlock}>
              <View style={[styles.titleBlockRow, { height: 50 }]}>
                <View
                  style={[
                    styles.titleBlockCell,
                    {
                      width: "40%",
                      alignItems: "center",
                      justifyContent: "center",
                    },
                  ]}
                >
                  {logoUrl ? (
                    <Image
                      src={logoUrl}
                      style={{ maxWidth: "80%", maxHeight: "80%" }}
                    />
                  ) : (
                    <Text style={{ fontSize: 12, fontWeight: "bold" }}>
                      LOGO
                    </Text>
                  )}
                </View>
                <View
                  style={[styles.titleBlockCell, { flex: 1, borderRight: 0 }]}
                >
                  <Text style={styles.label}>PROYECTO:</Text>
                  <Text style={[styles.value, { fontSize: 8 }]}>
                    LEVANTAMIENTO TOPOGRÁFICO
                  </Text>
                </View>
              </View>

              <View style={[styles.titleBlockRow, { height: 30 }]}>
                <View style={[styles.titleBlockCell, { flex: 1 }]}>
                  <Text style={styles.label}>PROPIETARIO:</Text>
                  <Text style={styles.value}>{propietario}</Text>
                </View>
              </View>

              <View style={[styles.titleBlockRow, { height: 25 }]}>
                <View style={[styles.titleBlockCell, { flex: 1 }]}>
                  <Text style={styles.label}>CONTENIDO:</Text>
                  <Text style={styles.value}>PERIMÉTRICO Y UBICACIÓN</Text>
                </View>
              </View>

              <View style={[styles.titleBlockRow, { height: 30 }]}>
                <View style={[styles.titleBlockCell, { flex: 1 }]}>
                  <Text style={styles.label}>UBICACIÓN:</Text>
                  <Text style={styles.valueSmall}>{ubicacion}</Text>
                </View>
              </View>

              <View style={[styles.titleBlockRow, { height: 40 }]}>
                <View
                  style={[
                    styles.titleBlockCell,
                    {
                      flex: 1,
                      alignItems: "center",
                      justifyContent: "flex-end",
                    },
                  ]}
                >
                  <Text style={{ fontSize: 4, color: "#999" }}>
                    FIRMA Y SELLO PROFESIONAL
                  </Text>
                </View>
              </View>

              <View style={[styles.titleBlockRow, { borderBottom: 0 }]}>
                <View style={[styles.titleBlockCell, { width: "25%" }]}>
                  <Text style={styles.label}>FECHA:</Text>
                  <Text style={styles.valueSmall}>{fecha}</Text>
                </View>
                <View style={[styles.titleBlockCell, { width: "25%" }]}>
                  <Text style={styles.label}>ESCALA:</Text>
                  <Text style={styles.valueSmall}>{escala}</Text>
                </View>
                <View
                  style={[
                    styles.titleBlockCell,
                    { width: "25%", backgroundColor: "#000", color: "#fff" },
                  ]}
                >
                  <Text style={[styles.label, { color: "#ccc" }]}>LÁMINA:</Text>
                  <Text style={[styles.value, { color: "#fff", fontSize: 10 }]}>
                    {lamina}
                  </Text>
                </View>
                <View
                  style={[
                    styles.titleBlockCell,
                    { width: "25%", borderRight: 0 },
                  ]}
                >
                  <Text style={styles.label}>LOTE:</Text>
                  <Text style={styles.valueSmall}>{loteId}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

/**
 * Mini croquis vectorial para la columna de información
 */
const LocationSketchMini = ({
  vertices,
  lotesAdyacentes,
  contexto,
}: {
  vertices: Point[];
  lotesAdyacentes: any[];
  contexto?: any;
}) => {
  const W = 240;
  const MAP_H = 80;
  const SVG_H = 110;

  let allPoints = [...vertices];
  lotesAdyacentes.forEach((lote) => {
    allPoints = allPoints.concat(lote.vertices);
  });

  const mainCx = vertices.reduce((acc, v) => acc + v.x, 0) / vertices.length;
  const mainCy = vertices.reduce((acc, v) => acc + v.y, 0) / vertices.length;

  const validContextVecinos = (contexto?.vecinos || []).filter(
    (vecino: any) => {
      if (!vecino || !vecino.vertices) return false;
      return vecino.vertices.some(
        (v: any) => dist(v, { x: mainCx, y: mainCy, id: "" }) <= 60,
      );
    },
  );

  const xs = allPoints.map((v) => v.x);
  const ys = allPoints.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const anchoReal = maxX - minX;
  const altoReal = maxY - minY;

  const scale = Math.min(
    (W * 0.8) / (anchoReal || 1),
    (MAP_H * 0.8) / (altoReal || 1),
  );
  const offsetX = (W - anchoReal * scale) / 2;
  const offsetY = (MAP_H - altoReal * scale) / 2;

  const toPaper = (x: number, y: number) => ({
    x: (x - minX) * scale + offsetX,
    y: MAP_H - ((y - minY) * scale + offsetY),
  });

  const mainPath =
    vertices
      .map((v, i) => {
        const p = toPaper(v.x, v.y);
        return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
      })
      .join(" ") + " Z";

  const cX = toPaper(mainCx, mainCy).x;
  const cY = toPaper(mainCx, mainCy).y;

  return (
    <View style={{ width: W, height: SVG_H, position: "relative" }}>
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: W,
          height: MAP_H,
          overflow: "hidden",
        }}
      >
        <Svg width={W} height={MAP_H}>
          <Rect
            x={0}
            y={0}
            width={W}
            height={MAP_H}
            fill="none"
            stroke="#000"
            strokeWidth={1}
          />
          {validContextVecinos.map((vecino: any, idx: number) => {
            const d =
              vecino.vertices
                .map((v: any, i: number) => {
                  const p = toPaper(v.x, v.y);
                  return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
                })
                .join(" ") + " Z";
            const ctxCx =
              vecino.vertices.reduce((acc: number, v: any) => acc + v.x, 0) /
              vecino.vertices.length;
            const ctxCy =
              vecino.vertices.reduce((acc: number, v: any) => acc + v.y, 0) /
              vecino.vertices.length;
            const ctxCentroid = toPaper(ctxCx, ctxCy);
            return (
              <G key={`ctx-${idx}`}>
                <Path d={d} fill="none" stroke="#e2e8f0" strokeWidth={0.5} />
                <Text
                  x={ctxCentroid.x}
                  y={ctxCentroid.y}
                  style={{ fontSize: 1, fill: "#999" }}
                  textAnchor="middle"
                >
                  {vecino.nombre}
                </Text>
              </G>
            );
          })}
          {lotesAdyacentes.map((lote, idx) => {
            const d =
              lote.vertices
                .map((v: any, i: number) => {
                  const p = toPaper(v.x, v.y);
                  return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
                })
                .join(" ") + " Z";
            const adyCx =
              lote.vertices.reduce((acc: number, v: any) => acc + v.x, 0) /
              lote.vertices.length;
            const adyCy =
              lote.vertices.reduce((acc: number, v: any) => acc + v.y, 0) /
              lote.vertices.length;
            const adyCentroid = toPaper(adyCx, adyCy);
            return (
              <G key={`ady-${idx}`}>
                <Path
                  d={d}
                  fill="none"
                  stroke="#ccc"
                  strokeWidth={0.5}
                  strokeDasharray="2,2"
                />
                <Text
                  x={adyCentroid.x}
                  y={adyCentroid.y}
                  style={{ fontSize: 1, fill: "#666" }}
                  textAnchor="middle"
                >
                  {lote.id}
                </Text>
              </G>
            );
          })}
          <Path d={mainPath} fill="#ccc" stroke="#000" strokeWidth={1} />
          <Circle
            cx={cX}
            cy={cY}
            r={9}
            fill="none"
            stroke="#000"
            strokeWidth={1}
          />
        </Svg>
      </View>

      <Svg
        width={W}
        height={SVG_H}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Path
          d={`M ${cX - 6.36} ${cY + 6.36} L 10 ${MAP_H} L 10 ${SVG_H - 12} L ${W - 10} ${SVG_H - 12}`}
          fill="none"
          stroke="#000"
          strokeWidth={0.75}
        />

        <Text
          x={W / 2}
          y={SVG_H - 15}
          style={{ fontSize: 7, fontWeight: "bold" }}
          textAnchor="middle"
        >
          PLANO DE LOCALIZACION
        </Text>
        <Text
          x={W / 2}
          y={SVG_H - 5}
          style={{ fontSize: 5 }}
          textAnchor="middle"
        >
          ESC:1/15,000
        </Text>
      </Svg>
    </View>
  );
};

export default PlanoDocument;
