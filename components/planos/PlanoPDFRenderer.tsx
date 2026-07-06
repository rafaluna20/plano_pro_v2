'use client';

import React from 'react';
import { Document, Page, View, Text, StyleSheet, Svg, Path, Line, Circle, Rect, G } from '@react-pdf/renderer';

// --- TIPOS ---
interface Point { id: string; x: number; y: number; }
interface Props {
  loteId?: string;
  propietario?: string;
  ubicacion?: string;
  vertices?: Point[];
  fecha?: string;
  escala?: string;
  lamina?: string;
}

// --- ESTILOS REACT-PDF ---
const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
    flexDirection: 'row',
  },
  container: {
    width: '100%',
    height: '100%',
    border: '1.5pt solid #000',
    flexDirection: 'row',
  },
  // Columna Izquierda (Gráfico)
  drawingArea: {
    flex: 1,
    borderRight: '1pt solid #000',
    padding: 10,
    position: 'relative',
  },
  // Columna Derecha (Datos)
  infoColumn: {
    width: 250,
    flexDirection: 'column',
  },
  // Secciones
  sectionHeader: {
    backgroundColor: '#000',
    color: '#fff',
    fontSize: 7,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 3,
    marginBottom: 4,
  },
  sectionBox: {
    borderBottom: '1pt solid #000',
    padding: 5,
  },
  // Tablas
  table: {
    width: '100%',
    borderTop: '1pt solid #000',
    borderLeft: '1pt solid #000',
    marginTop: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #000',
  },
  tableHeader: {
    backgroundColor: '#e0e0e0',
  },
  tableCell: {
    flex: 1,
    fontSize: 5,
    padding: 2,
    textAlign: 'center',
    borderRight: '1pt solid #000',
    justifyContent: 'center',
  },
  // Membrete
  titleBlock: {
    marginTop: 'auto',
    borderTop: '1.5pt solid #000',
  },
  titleBlockRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #000',
    minHeight: 25,
  },
  titleBlockCell: {
    borderRight: '1pt solid #000',
    padding: 3,
    justifyContent: 'center',
  },
  label: { fontSize: 5, color: '#666', marginBottom: 1, textTransform: 'uppercase' },
  value: { fontSize: 8, fontWeight: 'bold', color: '#000' },
  valueSmall: { fontSize: 7, color: '#000' },
});

// --- UTILIDADES MATEMÁTICAS ---
const decimalToDMS = (decimal: number) => {
  const d = Math.floor(decimal);
  const m = Math.floor((decimal - d) * 60);
  const s = ((decimal - d) * 60 - m) * 60;
  return `${d}°${m.toString().padStart(2, '0')}'${s.toFixed(0).padStart(2, '0')}"`;
};

const decimalToDMSShort = (decimal: number) => {
  const d = Math.floor(decimal);
  const m = Math.floor((decimal - d) * 60);
  return `${d}°${m.toString().padStart(2, '0')}'`;
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

// --- COMPONENTE DOCUMENTO ---
export const PlanoTopograficoPDF = ({ 
  loteId = "L-001", 
  propietario = "JUAN PEREZ", 
  ubicacion = "MIRAFLORES, LIMA",
  vertices: initialVertices,
  fecha = new Date().toLocaleDateString('es-PE'),
  escala = "1/100",
  lamina = "P-01"
}: Props) => {

  // Datos por defecto
  const vertices = initialVertices || [
    { id: 'A', x: 280500.00, y: 8660000.00 },
    { id: 'B', x: 280540.50, y: 8660010.20 },
    { id: 'C', x: 280550.00, y: 8659980.50 },
    { id: 'D', x: 280510.00, y: 8659960.00 },
  ];

  const area = calculatePolygonArea(vertices);
  const perimetro = calculatePerimeter(vertices);

  // --- CÁLCULOS DE VIEWPORT ---
  // A3 Landscape aprox en puntos (points)
  // Ancho total ~841pt, Alto ~595pt
  // Restando márgenes y columna derecha (250pt), nos queda para dibujo:
  const VIEWPORT_W = 530; 
  const VIEWPORT_H = 500;

  const xs = vertices.map(v => v.x);
  const ys = vertices.map(v => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const anchoReal = maxX - minX;
  const altoReal = maxY - minY;
  
  const MARGIN_PCT = 0.15;
  const scaleX = (VIEWPORT_W * (1 - MARGIN_PCT)) / anchoReal;
  const scaleY = (VIEWPORT_H * (1 - MARGIN_PCT)) / altoReal;
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (VIEWPORT_W - anchoReal * scale) / 2;
  const offsetY = (VIEWPORT_H - altoReal * scale) / 2;

  const toPaper = (x: number, y: number) => ({
    x: (x - minX) * scale + offsetX,
    y: VIEWPORT_H - ((y - minY) * scale + offsetY)
  });

  // Grilla
  const maxDim = Math.max(anchoReal, altoReal);
  let step = 10;
  if (maxDim > 50) step = 20;
  else if (maxDim > 100) step = 50;
  else if (maxDim > 500) step = 100;

  const gridStartX = Math.floor(minX / step) * step;
  const gridEndX = Math.ceil(maxX / step) * step;
  const gridStartY = Math.floor(minY / step) * step;
  const gridEndY = Math.ceil(maxY / step) * step;

  const gridLinesX: number[] = [];
  for (let x = gridStartX; x <= gridEndX; x += step) gridLinesX.push(x);
  const gridLinesY: number[] = [];
  for (let y = gridStartY; y <= gridEndY; y += step) gridLinesY.push(y);

  // Datos procesados
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
      norte: v.y.toFixed(2)
    };
  });

  // Path del polígono
  const pathData = vertices.map((v, i) => {
    const p = toPaper(v.x, v.y);
    return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
  }).join(' ') + ' Z';

  // Centroide
  const cx = vertices.reduce((acc, v) => acc + v.x, 0) / vertices.length;
  const cy = vertices.reduce((acc, v) => acc + v.y, 0) / vertices.length;
  const centroid = toPaper(cx, cy);

  // Función arco ángulo para SVG
  const getAngleArc = (prev: Point, curr: Point, next: Point, radius: number = 20) => {
    const pPrev = toPaper(prev.x, prev.y);
    const pCurr = toPaper(curr.x, curr.y);
    const pNext = toPaper(next.x, next.y);

    const angPrev = Math.atan2(pPrev.y - pCurr.y, pPrev.x - pCurr.x);
    const angNext = Math.atan2(pNext.y - pCurr.y, pNext.x - pCurr.x);

    let startAngle = angPrev;
    let endAngle = angNext;
    
    let diff = endAngle - startAngle;
    while (diff <= -Math.PI) diff += 2 * Math.PI;
    while (diff > Math.PI) diff -= 2 * Math.PI;

    let sweepFlag = 1;
    if (diff < 0) sweepFlag = 0;

    const startX = pCurr.x + radius * Math.cos(startAngle);
    const startY = pCurr.y + radius * Math.sin(startAngle);
    const endX = pCurr.x + radius * Math.cos(endAngle);
    const endY = pCurr.y + radius * Math.sin(endAngle);

    return `M ${startX} ${startY} A ${radius} ${radius} 0 0 ${sweepFlag} ${endX} ${endY}`;
  };

  const TextAny = Text as any;

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={styles.page}>
        <View style={styles.container}>
          
          {/* --- ZONA DE DIBUJO --- */}
          <View style={styles.drawingArea}>
            <Svg width={VIEWPORT_W} height={VIEWPORT_H}>
              
              {/* Grillas y Cruces */}
              {gridLinesX.map(x => 
                gridLinesY.map(y => {
                  const p = toPaper(x, y);
                  if (p.x > 0 && p.x < VIEWPORT_W && p.y > 0 && p.y < VIEWPORT_H) {
                    return (
                      <G key={`${x}-${y}`}>
                         <Line x1={p.x - 4} y1={p.y} x2={p.x + 4} y2={p.y} stroke="#666" strokeWidth={0.5} />
                         <Line x1={p.x} y1={p.y - 4} x2={p.x} y2={p.y + 4} stroke="#666" strokeWidth={0.5} />
                      </G>
                    );
                  }
                  return null;
                })
              )}

              {/* Etiquetas Grilla */}
              {gridLinesX.map((x, i) => {
                if (i % 2 !== 0) return null;
                const p = toPaper(x, gridLinesY[0]);
                return (
                  <TextAny key={`lx-${x}`} x={p.x} y={VIEWPORT_H - 5} style={{ fontSize: 5, fill: "#444", textAnchor: "middle" }}>
                    {`${x.toFixed(0)}E`}
                  </TextAny>
                );
              })}
              {gridLinesY.map((y, i) => {
                if (i % 2 !== 0) return null;
                const p = toPaper(gridLinesX[0], y);
                return (
                  <TextAny key={`ly-${y}`} x={5} y={p.y} style={{ fontSize: 5, fill: "#444", textAnchor: "start" }}>
                    {`${y.toFixed(0)}N`}
                  </TextAny>
                );
              })}

              {/* Polígono */}
              <Path d={pathData} fill="#eeeeee" stroke="#000" strokeWidth={1.5} />

              {/* Etiqueta Central Área/Perímetro */}
              <G>
                <Rect 
                  x={centroid.x - 50} 
                  y={centroid.y - 10} 
                  width={100} 
                  height={20} 
                  fill="white" 
                  stroke="#000" 
                  strokeWidth={0.5} 
                />
                <TextAny x={centroid.x} y={centroid.y - 2} style={{ fontSize: 5, fontWeight: "bold", textAnchor: "middle" }}>
                  {`ÁREA = ${area.toFixed(2)} m²`}
                </TextAny>
                <TextAny x={centroid.x} y={centroid.y + 5} style={{ fontSize: 5, fontWeight: "bold", textAnchor: "middle" }}>
                  {`PERÍMETRO = ${perimetro.toFixed(2)} ml`}
                </TextAny>
              </G>

              {/* Vértices y Ángulos */}
              {vertices.map((v, i) => {
                const p = toPaper(v.x, v.y);
                const nextV = vertices[(i + 1) % vertices.length];
                const prevV = vertices[(i - 1 + vertices.length) % vertices.length];
                const pNext = toPaper(nextV.x, nextV.y);

                const midX = (p.x + pNext.x) / 2;
                const midY = (p.y + pNext.y) / 2;
                const distVal = dist(v, nextV).toFixed(2);
                
                const anguloVal = datosTecnicos[i].angValue;
                const arcPath = getAngleArc(prevV, v, nextV, 20);

                return (
                  <G key={`v-${i}`}>
                    {/* Arco Ángulo */}
                    <Path d={arcPath} stroke="#666" strokeWidth={0.5} strokeDasharray="2,2" fill="none" />
                    <TextAny x={p.x + 15} y={p.y - 10} style={{ fontSize: 5, fill: "#666" }}>
                      {decimalToDMSShort(anguloVal)}
                    </TextAny>

                    {/* Vértice */}
                    <Circle cx={p.x} cy={p.y} r={2} fill="white" stroke="#000" strokeWidth={0.5} />
                    <TextAny x={p.x + 3} y={p.y - 3} style={{ fontSize: 6, fontWeight: "bold" }}>
                      {v.id}
                    </TextAny>

                    {/* Distancia Lado */}
                    <Rect x={midX - 10} y={midY - 4} width={20} height={8} fill="white" />
                    <TextAny x={midX} y={midY} style={{ fontSize: 5, textAnchor: "middle" }}>
                      {`${distVal}m`}
                    </TextAny>
                  </G>
                );
              })}

              {/* Norte */}
              <G transform={`translate(${VIEWPORT_W - 50}, 50)`}>
                 <Line x1={0} y1={-20} x2={0} y2={20} stroke="black" strokeWidth={1} />
                 <Path d="M 0 -20 L -3 -10 L 3 -10 Z" fill="black" />
                 <TextAny x={-3} y={-25} style={{ fontSize: 10, fontWeight: "bold" }}>N</TextAny>
              </G>

            </Svg>

            <View style={{ position: 'absolute', bottom: 10, left: 10 }}>
              <Text style={{ fontSize: 6, color: '#666' }}>PROYECCIÓN: UTM WGS84 - ZONA 18S</Text>
            </View>
          </View>

          {/* --- COLUMNA DE INFORMACIÓN --- */}
          <View style={styles.infoColumn}>
            
            {/* Ubicación Esquemática */}
            <View style={[styles.sectionBox, { height: 100, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={styles.sectionHeader}>UBICACIÓN ESQUEMÁTICA</Text>
              <Text style={{ fontSize: 6, color: '#999' }}>[MAPA DE REFERENCIA]</Text>
              <Text style={{ fontSize: 6, marginTop: 5 }}>SIN ESCALA</Text>
            </View>

            {/* Cuadro de Datos */}
            <View style={[styles.sectionBox, { flex: 1 }]}>
              <Text style={styles.sectionHeader}>CUADRO DE DATOS TÉCNICOS</Text>
              <Text style={{ fontSize: 5, textAlign: 'center', marginBottom: 2 }}>DATUM WGS84</Text>

              <View style={styles.table}>
                <View style={[styles.tableRow, styles.tableHeader]}>
                  <Text style={[styles.tableCell, { width: '10%' }]}>V</Text>
                  <Text style={[styles.tableCell, { width: '15%' }]}>LADO</Text>
                  <Text style={[styles.tableCell, { width: '15%' }]}>DIST</Text>
                  <Text style={[styles.tableCell, { width: '20%' }]}>ANG</Text>
                  <Text style={[styles.tableCell, { width: '20%' }]}>ESTE</Text>
                  <Text style={[styles.tableCell, { width: '20%', borderRight: 0 }]}>NORTE</Text>
                </View>

                {datosTecnicos.map((row, i) => (
                  <View key={i} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { width: '10%', fontWeight: 'bold' }]}>{row.vertice}</Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>{row.lado}</Text>
                    <Text style={[styles.tableCell, { width: '15%' }]}>{row.dist}</Text>
                    <Text style={[styles.tableCell, { width: '20%', fontSize: 4 }]}>{row.ang}</Text>
                    <Text style={[styles.tableCell, { width: '20%' }]}>{row.este}</Text>
                    <Text style={[styles.tableCell, { width: '20%', borderRight: 0 }]}>{row.norte}</Text>
                  </View>
                ))}
              </View>

              <View style={{ marginTop: 5, padding: 5, backgroundColor: '#f0f0f0' }}>
                 <Text style={{ fontSize: 6, fontWeight: 'bold' }}>ÁREA: {area.toFixed(2)} m²</Text>
                 <Text style={{ fontSize: 6, fontWeight: 'bold' }}>PERÍMETRO: {perimetro.toFixed(2)} ml</Text>
              </View>
            </View>

            {/* Membrete */}
            <View style={styles.titleBlock}>
              
              <View style={[styles.titleBlockRow, { height: 35 }]}>
                <View style={[styles.titleBlockCell, { flex: 1 }]}>
                  <Text style={styles.label}>PROYECTO:</Text>
                  <Text style={[styles.value, { fontSize: 8 }]}>LEVANTAMIENTO TOPOGRÁFICO</Text>
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
                <View style={[styles.titleBlockCell, { flex: 1, alignItems: 'center', justifyContent: 'flex-end' }]}>
                   <Text style={{ fontSize: 4, color: '#999' }}>FIRMA Y SELLO PROFESIONAL</Text>
                </View>
              </View>

              <View style={[styles.titleBlockRow, { borderBottom: 0 }]}>
                <View style={[styles.titleBlockCell, { width: '25%' }]}>
                  <Text style={styles.label}>FECHA:</Text>
                  <Text style={styles.valueSmall}>{fecha}</Text>
                </View>
                <View style={[styles.titleBlockCell, { width: '25%' }]}>
                  <Text style={styles.label}>ESCALA:</Text>
                  <Text style={styles.valueSmall}>{escala}</Text>
                </View>
                <View style={[styles.titleBlockCell, { width: '25%', backgroundColor: '#000', color: '#fff' }]}>
                  <Text style={[styles.label, { color: '#ccc' }]}>LÁMINA:</Text>
                  <Text style={[styles.value, { color: '#fff', fontSize: 10 }]}>{lamina}</Text>
                </View>
                <View style={[styles.titleBlockCell, { width: '25%', borderRight: 0 }]}>
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

export default PlanoTopograficoPDF;