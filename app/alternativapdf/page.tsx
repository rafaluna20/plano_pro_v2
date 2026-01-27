'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PDFViewer, PDFDownloadLink, Document, Page, View, Text, StyleSheet, Svg, Path, Line, Circle, Rect, G } from '@react-pdf/renderer';



// --- CONSTANTES DE DISEÑO ---
const COLORS = {
  border: '#000000',
  grid: '#e0e0e0',
  text: '#222222',
  secondaryText: '#555555',
  highlight: '#eeeeee'
};

const STROKES = {
  boundary: 2.0, // Línea de propiedad gruesa
  dimension: 0.5, // Cotas finas
  grid: 0.5,
  axis: 1.0
};

// --- TIPOS ---
interface Point { id: string; x: number; y: number; }
interface Props {
  loteId?: string;
  propietario?: string;
  ubicacion?: string;
  vertices?: Point[];
  fecha?: string;
  lamina?: string;
}

// --- ESTILOS ---
const styles = StyleSheet.create({
  page: { padding: 15, fontFamily: 'Helvetica', backgroundColor: '#fff', flexDirection: 'row' },
  container: { width: '100%', height: '100%', border: '2pt solid #000', flexDirection: 'row' },
  
  // Áreas
  drawingArea: { flex: 1, position: 'relative', overflow: 'hidden' },
  infoColumn: { width: 240, borderLeft: '2pt solid #000', flexDirection: 'column' },
  
  // Tablas y Cuadros
  headerBox: { backgroundColor: '#000', padding: 4, marginBottom: 2 },
  headerText: { color: '#fff', fontSize: 7, fontWeight: 'bold', textAlign: 'center' },
  
  tableContainer: { borderTop: '1pt solid #000', borderLeft: '1pt solid #000', margin: 5 },
  row: { flexDirection: 'row', borderBottom: '1pt solid #000' },
  headerRow: { backgroundColor: '#d3d3d3' },
  cell: { flex: 1, fontSize: 5, padding: 3, textAlign: 'center', borderRight: '1pt solid #000' },
  
  // Membrete
  titleBlock: { marginTop: 'auto', borderTop: '2pt solid #000' },
  blockRow: { flexDirection: 'row', borderBottom: '1pt solid #000', minHeight: 20 },
  blockCell: { borderRight: '1pt solid #000', padding: 4, flex: 1, justifyContent: 'center' },
  label: { fontSize: 5, color: '#666', textTransform: 'uppercase' },
  value: { fontSize: 7, fontWeight: 'bold', color: '#000' },
  
  // Notas
  notes: { padding: 5, fontSize: 5, color: '#444' }
});

// --- UTILIDADES MATEMÁTICAS ---
const formatCoord = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDist = (n: number) => n.toFixed(2);

const decimalToDMS = (decimal: number) => {
  const d = Math.floor(decimal);
  const m = Math.floor((decimal - d) * 60);
  const s = ((decimal - d) * 60 - m) * 60;
  return `${d}°${m.toString().padStart(2, '0')}'${s.toFixed(0).padStart(2, '0')}"`;
};

const getDistance = (p1: Point, p2: Point) => Math.hypot(p2.x - p1.x, p2.y - p1.y);

// Algoritmo de Shoelace para área
const getArea = (vertices: Point[]) => {
  let area = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    area += (vertices[i].x * vertices[(i + 1) % n].y) - (vertices[(i + 1) % n].x * vertices[i].y);
  }
  return Math.abs(area) / 2;
};

// --- COMPONENTE PRINCIPAL ---
const PlanoTopograficoPDF = ({ 
  loteId = "LOTE-01", 
  propietario = "EMPRESA DESARROLLADORA S.A.C.", 
  ubicacion = "AV. PRINCIPAL 123, LIMA",
  fecha = new Date().toLocaleDateString('es-PE'),
  lamina = "U-01",
  vertices: inputVertices
}: Props) => {

  // Datos de prueba si no vienen props
  const vertices = useMemo(() => inputVertices || [
    { id: 'A', x: 280500.00, y: 8660000.00 },
    { id: 'B', x: 280562.30, y: 8660025.50 },
    { id: 'C', x: 280590.10, y: 8659980.20 },
    { id: 'D', x: 280520.40, y: 8659950.10 },
  ], [inputVertices]);

  // Cálculos Geométricos
  const area = getArea(vertices);
  const perimetro = vertices.reduce((acc, p, i) => acc + getDistance(p, vertices[(i + 1) % vertices.length]), 0);

  // Viewport Configuration
  const WIDTH = 560; // Puntos disponibles ancho dibujo
  const HEIGHT = 550; // Puntos disponibles alto dibujo
  const PADDING = 40; // Margen interno para cotas y grillas

  // Bounding Box
  const xs = vertices.map(p => p.x);
  const ys = vertices.map(p => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const spanX = maxX - minX;
  const spanY = maxY - minY;

  // Escala "Best Fit"
  const scaleX = (WIDTH - PADDING * 2) / spanX;
  const scaleY = (HEIGHT - PADDING * 2) / spanY;
  const scale = Math.min(scaleX, scaleY);
  
  // Escala Numérica Aproximada (1:X)
  // 1 punto PDF = 1/72 pulgada. 1 pulgada = 2.54 cm.
  // Cálculo aproximado para referencia visual
  const scaleFactor = Math.round(1 / (scale * (1/72) * 0.0254)); 

  // Transformación Mundo -> Papel
  const toScreen = (x: number, y: number) => ({
    x: PADDING + (x - minX) * scale + (WIDTH - PADDING * 2 - spanX * scale) / 2,
    y: HEIGHT - (PADDING + (y - minY) * scale + (HEIGHT - PADDING * 2 - spanY * scale) / 2) // Invertir Y
  });

  const centroid = {
    x: xs.reduce((a,b)=>a+b,0)/vertices.length,
    y: ys.reduce((a,b)=>a+b,0)/vertices.length
  };
  const centerScreen = toScreen(centroid.x, centroid.y);

  // Generación de Grilla Inteligente
  const gridSizeReal = Math.max(spanX, spanY) / 4; // Dividir en ~4 cuadrantes
  // Redondear a números bonitos (10, 20, 50, 100)
  const power = Math.floor(Math.log10(gridSizeReal));
  const base = Math.pow(10, power);
  let step = base;
  if (gridSizeReal / base < 2) step = base / 2;
  else if (gridSizeReal / base > 5) step = base * 2;
  
  const gridXStart = Math.floor(minX / step) * step;
  const gridYStart = Math.floor(minY / step) * step;
  
  const gridsX = [];
  for(let x = gridXStart; x <= maxX + step; x += step) gridsX.push(x);
  const gridsY = [];
  for(let y = gridYStart; y <= maxY + step; y += step) gridsY.push(y);

  // Path del Polígono
  const polyPath = vertices.map((v, i) => {
    const p = toScreen(v.x, v.y);
    return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
  }).join(' ') + ' Z';

  // Datos Técnicos para la tabla
  const technicalData = vertices.map((curr, i) => {
    const next = vertices[(i + 1) % vertices.length];
    const prev = vertices[(i - 1 + vertices.length) % vertices.length];
    
    // Ángulo interno (Simplificado, asume polígono simple)
    const ang1 = Math.atan2(prev.y - curr.y, prev.x - curr.x);
    const ang2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let interiorAngle = (ang2 - ang1) * (180 / Math.PI);
    if (interiorAngle < 0) interiorAngle += 360;
    
    return {
      vertice: curr.id,
      lado: `${curr.id}-${next.id}`,
      dist: getDistance(curr, next),
      ang: interiorAngle,
      este: curr.x,
      norte: curr.y
    };
  });

  return (
    <Document>
      <Page size="A3" orientation="landscape" style={styles.page}>
        <View style={styles.container}>
          
          {/* === ZONA DE DIBUJO === */}
          <View style={styles.drawingArea}>
            <Svg width={WIDTH} height={HEIGHT}>
              
              {/* Grilla (Lineas finas de fondo) */}
              {gridsX.map(x => {
                const p = toScreen(x, minY); 
                if (p.x < 0 || p.x > WIDTH) return null;
                return (
                  <G key={`gx-${x}`}>
                     <Line x1={p.x} y1={0} x2={p.x} y2={HEIGHT} stroke={COLORS.grid} strokeWidth={STROKES.grid} />
                     <Text x={p.x + 2} y={HEIGHT - 5} style={{ fontSize: 5, fill: COLORS.secondaryText }}>{x.toFixed(0)} E</Text>
                     <Text x={p.x + 2} y={10} style={{ fontSize: 5, fill: COLORS.secondaryText }}>{x.toFixed(0)} E</Text>
                  </G>
                )
              })}
              {gridsY.map(y => {
                const p = toScreen(minX, y);
                if (p.y < 0 || p.y > HEIGHT) return null;
                return (
                  <G key={`gy-${y}`}>
                    <Line x1={0} y1={p.y} x2={WIDTH} y2={p.y} stroke={COLORS.grid} strokeWidth={STROKES.grid} />
                    <Text x={5} y={p.y - 2} style={{ fontSize: 5, fill: COLORS.secondaryText }}>{y.toFixed(0)} N</Text>
                    <Text x={WIDTH - 30} y={p.y - 2} style={{ fontSize: 5, fill: COLORS.secondaryText }}>{y.toFixed(0)} N</Text>
                  </G>
                )
              })}

              {/* Polígono Principal */}
              <Path d={polyPath} fill="#f9f9f9" stroke={COLORS.border} strokeWidth={STROKES.boundary} />

              {/* Vértices y Detalles */}
              {technicalData.map((data, i) => {
                const p = toScreen(data.este, data.norte);
                const nextData = technicalData[(i + 1) % technicalData.length];
                const pNext = toScreen(nextData.este, nextData.norte);
                
                // Punto Medio para distancia
                const midX = (p.x + pNext.x) / 2;
                const midY = (p.y + pNext.y) / 2;

                return (
                  <G key={`v-detail-${i}`}>
                    {/* Marcador Vértice */}
                    <Circle cx={p.x} cy={p.y} r={2.5} fill="#fff" stroke="#000" strokeWidth={1} />
                    <Circle cx={p.x} cy={p.y} r={0.5} fill="#000" />
                    
                    {/* Etiqueta Vértice (Offset inteligente) */}
                    <Text x={p.x + 4} y={p.y - 4} style={{ fontSize: 7, fontWeight: 'bold' }}>{data.vertice}</Text>

                    {/* Distancia en el lado */}
                    <G transform={`rotate(${(Math.atan2(pNext.y - p.y, pNext.x - p.x) * 180 / Math.PI)}, ${midX}, ${midY})`}>
                       <Rect x={midX - 12} y={midY - 4} width={24} height={8} fill="#fff" opacity={0.8} />
                       <Text x={midX} y={midY + 2} style={{ fontSize: 6 }} textAnchor="middle">{formatDist(data.dist)}m</Text>
                    </G>
                  </G>
                );
              })}

              {/* Norte Magnético (Estilizado) */}
              <G transform={`translate(${WIDTH - 50}, 50)`}>
                <Line x1={0} y1={-25} x2={0} y2={25} stroke="#000" strokeWidth={1} />
                <Path d="M 0 -25 L 5 -10 L 0 -5 L -5 -10 Z" fill="#000" />
                <Text x={-3} y={-30} style={{ fontSize: 9, fontWeight: 'bold' }}>N</Text>
                <Text x={-15} y={35} style={{ fontSize: 5 }}>WGS-84 / Z18S</Text>
              </G>

              {/* Escala Gráfica (Vital para planos PDF) */}
              <G transform={`translate(40, ${HEIGHT - 30})`}>
                 <Text x={0} y={-5} style={{ fontSize: 5 }}>ESCALA GRÁFICA</Text>
                 {/* Barra de escala: Calculamos cuánto mide 'step' en pantalla */}
                 <Line x1={0} y1={0} x2={step * scale} y2={0} stroke="#000" strokeWidth={2} />
                 <Line x1={0} y1={0} x2={0} y2={-3} stroke="#000" strokeWidth={1} />
                 <Line x1={step * scale} y1={0} x2={step * scale} y2={-3} stroke="#000" strokeWidth={1} />
                 <Line x1={(step/2) * scale} y1={0} x2={(step/2) * scale} y2={-2} stroke="#000" strokeWidth={1} />
                 
                 <Text x={0} y={6} style={{ fontSize: 5 }} textAnchor="middle">0</Text>
                 <Text x={(step/2) * scale} y={6} style={{ fontSize: 5 }} textAnchor="middle">{step/2}m</Text>
                 <Text x={step * scale} y={6} style={{ fontSize: 5 }} textAnchor="middle">{step}m</Text>
              </G>

              {/* Etiqueta Área Central */}
              <Text x={centerScreen.x} y={centerScreen.y} style={{ fontSize: 8, fontWeight: 'bold' }} textAnchor="middle">
                 ÁREA: {area.toFixed(2)} m²
              </Text>
            </Svg>
          </View>

          {/* === COLUMNA DE DATOS === */}
          <View style={styles.infoColumn}>
            
            {/* Cuadro Técnico */}
            <View style={{ padding: 5 }}>
               <View style={styles.headerBox}><Text style={styles.headerText}>CUADRO DE DATOS TÉCNICOS</Text></View>
               <Text style={{ fontSize: 5, textAlign: 'center' }}>SISTEMA DE PROYECCIÓN UTM - DATUM WGS84</Text>
               
               <View style={styles.tableContainer}>
                 <View style={[styles.row, styles.headerRow]}>
                    <Text style={[styles.cell, { width: '10%' }]}>V</Text>
                    <Text style={[styles.cell, { width: '15%' }]}>LADO</Text>
                    <Text style={[styles.cell, { width: '15%' }]}>DIST.</Text>
                    <Text style={[styles.cell, { width: '20%' }]}>ÁNGULO</Text>
                    <Text style={[styles.cell, { width: '20%' }]}>ESTE (X)</Text>
                    <Text style={[styles.cell, { width: '20%', borderRight: 0 }]}>NORTE (Y)</Text>
                 </View>

                 {technicalData.map((row, i) => (
                   <View key={i} style={styles.row}>
                     <Text style={[styles.cell, { width: '10%', fontWeight: 'bold' }]}>{row.vertice}</Text>
                     <Text style={[styles.cell, { width: '15%' }]}>{row.lado}</Text>
                     <Text style={[styles.cell, { width: '15%' }]}>{formatDist(row.dist)}</Text>
                     <Text style={[styles.cell, { width: '20%' }]}>{decimalToDMS(row.ang)}</Text>
                     <Text style={[styles.cell, { width: '20%', fontSize: 4.5 }]}>{formatCoord(row.este)}</Text>
                     <Text style={[styles.cell, { width: '20%', fontSize: 4.5, borderRight: 0 }]}>{formatCoord(row.norte)}</Text>
                   </View>
                 ))}
                 
                 <View style={{ flexDirection: 'row', backgroundColor: '#f0f0f0', padding: 2 }}>
                    <Text style={{ fontSize: 5, flex: 1, textAlign: 'center' }}>PERÍMETRO TOTAL: {formatDist(perimetro)} ml</Text>
                 </View>
               </View>
            </View>

            {/* Espacio para Croquis de Localización (Placeholder Profesional) */}
            <View style={{ flex: 1, padding: 5, justifyContent: 'center', alignItems: 'center' }}>
                <View style={{ width: '90%', height: 120, border: '1pt solid #ccc', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ fontSize: 6, color: '#999' }}>ESPACIO PARA CROQUIS DE LOCALIZACIÓN</Text>
                    <Text style={{ fontSize: 5, color: '#aaa' }}>(Google Maps / Satélite)</Text>
                </View>
            </View>
            
            <View style={styles.notes}>
                <Text style={{ fontWeight: 'bold', marginBottom: 2 }}>NOTAS TÉCNICAS:</Text>
                <Text>1. Levantamiento topográfico realizado con Estación Total / GPS Diferencial.</Text>
                <Text>2. Coordenadas referidas al elipsoide WGS84.</Text>
                <Text>3. Las distancias son horizontales.</Text>
            </View>

            {/* Membrete Estilo Catastral */}
            <View style={styles.titleBlock}>
               <View style={styles.blockRow}>
                  <View style={[styles.blockCell, { flex: 2 }]}>
                     <Text style={styles.label}>PROYECTO:</Text>
                     <Text style={styles.value}>LEVANTAMIENTO PERIMÉTRICO</Text>
                  </View>
                  <View style={styles.blockCell}>
                     <Text style={styles.label}>LÁMINA:</Text>
                     <Text style={[styles.value, { fontSize: 12 }]}>{lamina}</Text>
                  </View>
               </View>

               <View style={styles.blockRow}>
                  <View style={styles.blockCell}>
                     <Text style={styles.label}>PROPIETARIO:</Text>
                     <Text style={styles.value}>{propietario}</Text>
                  </View>
               </View>
               
               <View style={styles.blockRow}>
                  <View style={styles.blockCell}>
                     <Text style={styles.label}>UBICACIÓN:</Text>
                     <Text style={styles.value}>{ubicacion}</Text>
                  </View>
               </View>

               <View style={styles.blockRow}>
                  <View style={styles.blockCell}>
                     <Text style={styles.label}>FECHA:</Text>
                     <Text style={styles.value}>{fecha}</Text>
                  </View>
                  <View style={styles.blockCell}>
                     <Text style={styles.label}>ESCALA IMPRESIÓN:</Text>
                     <Text style={styles.value}>1/{scaleFactor}</Text>
                  </View>
                  <View style={[styles.blockCell, { borderRight: 0 }]}>
                     <Text style={styles.label}>CÓDIGO:</Text>
                     <Text style={styles.value}>{loteId}</Text>
                  </View>
               </View>
               
               {/* Área de Sellos */}
               <View style={[styles.blockRow, { height: 60, borderBottom: 0 }]}>
                   <View style={[styles.blockCell, { borderRight: '1pt solid #000' }]}>
                       <Text style={[styles.label, { textAlign: 'center', marginTop: 40 }]}>FIRMA PROFESIONAL RESPONSABLE</Text>
                   </View>
                   <View style={[styles.blockCell, { borderRight: 0 }]}>
                       <Text style={[styles.label, { textAlign: 'center', marginTop: 40 }]}>FIRMA PROPIETARIO</Text>
                   </View>
               </View>

            </View>
          </View>

        </View>
      </Page>
    </Document>
  );
};

export default function VisorPlanoPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) return <div className="p-10 text-center">Cargando motor gráfico...</div>;

  return (
    <div className="w-full h-screen bg-gray-600 p-4">
      <div className="bg-white rounded-lg shadow-xl overflow-hidden h-full">
         <PDFViewer width="100%" height="100%" className="border-0">
            <PlanoTopograficoPDF />
         </PDFViewer>
      </div>
    </div>
  );
}