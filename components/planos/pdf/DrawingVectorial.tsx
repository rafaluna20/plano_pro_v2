import {
  View,
  Text,
  Svg,
  Path,
  Line,
  Circle,
  Rect,
  G,
} from "@react-pdf/renderer";

interface Point {
  id: string;
  x: number;
  y: number;
}

export interface LoteAdyacente {
  id: string;
  vertices: Point[];
}

interface DatosTecnicosRow {
  vertice: string;
  lado: string;
  dist: string;
  angValue: number;
  ang: string;
  este: string;
  norte: string;
}

interface Props {
  vertices: Point[];
  datosTecnicos: DatosTecnicosRow[];
  area: number;
  perimetro: number;
  lotesAdyacentes?: LoteAdyacente[];
  contexto?: { vecinos: { id: string; nombre: string; vertices: Point[] }[] };
}

const dist = (p1: Point, p2: Point) =>
  Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

const decimalToDMSShort = (decimal: number) => {
  const d = Math.floor(decimal);
  const m = Math.floor((decimal - d) * 60);
  return `${d}°${m.toString().padStart(2, "0")}'`;
};

export const DrawingVectorial = ({
  vertices,
  datosTecnicos,
  area,
  perimetro,
  lotesAdyacentes = [],
  contexto,
}: Props) => {
  const VIEWPORT_W = 530;
  const VIEWPORT_H = 500;

  let allPoints = [...vertices];
  lotesAdyacentes.forEach((lote) => {
    allPoints = allPoints.concat(lote.vertices);
  });

  const mainCx = vertices.reduce((acc, v) => acc + v.x, 0) / vertices.length;
  const mainCy = vertices.reduce((acc, v) => acc + v.y, 0) / vertices.length;

  const validContextVecinos = (contexto?.vecinos || []).filter((vecino) => {
    if (!vecino || !vecino.vertices) return false;
    return vecino.vertices.some(
      (v) => dist(v, { x: mainCx, y: mainCy, id: "" }) <= 60,
    );
  });

  console.log("validContextVecinos", validContextVecinos);

  validContextVecinos.forEach((vecino) => {
    allPoints = allPoints.concat(vecino.vertices);
  });

  const xs = allPoints.map((v) => v.x);
  const ys = allPoints.map((v) => v.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const anchoReal = maxX - minX;
  const altoReal = maxY - minY;

  const MARGIN_PCT = 0.15;
  // Fallback to 1 if real width/height is 0
  const scaleX = (VIEWPORT_W * (1 - MARGIN_PCT)) / (anchoReal || 1);
  const scaleY = (VIEWPORT_H * (1 - MARGIN_PCT)) / (altoReal || 1);
  const scale = Math.min(scaleX, scaleY);

  const offsetX = (VIEWPORT_W - anchoReal * scale) / 2;
  const offsetY = (VIEWPORT_H - altoReal * scale) / 2;

  const toPaper = (x: number, y: number) => ({
    x: (x - minX) * scale + offsetX,
    y: VIEWPORT_H - ((y - minY) * scale + offsetY),
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

  // Path del polígono
  const pathData =
    vertices
      .map((v, i) => {
        const p = toPaper(v.x, v.y);
        return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
      })
      .join(" ") + " Z";

  // Centroide
  const cx = vertices.reduce((acc, v) => acc + v.x, 0) / vertices.length;
  const cy = vertices.reduce((acc, v) => acc + v.y, 0) / vertices.length;
  const centroid = toPaper(cx, cy);

  // Función arco ángulo para SVG
  const getAngleArc = (
    prev: Point,
    curr: Point,
    next: Point,
    radius: number = 20,
  ) => {
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

  return (
    <View
      style={{
        width: "100%",
        height: "100%",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Svg width={VIEWPORT_W} height={VIEWPORT_H}>
        {/* Grillas y Cruces */}
        {gridLinesX.map((x) =>
          gridLinesY.map((y) => {
            const p = toPaper(x, y);
            if (p.x > 0 && p.x < VIEWPORT_W && p.y > 0 && p.y < VIEWPORT_H) {
              return (
                <G key={`${x}-${y}`}>
                  <Line
                    x1={p.x - 4}
                    y1={p.y}
                    x2={p.x + 4}
                    y2={p.y}
                    stroke="#666"
                    strokeWidth={0.5}
                  />
                  <Line
                    x1={p.x}
                    y1={p.y - 4}
                    x2={p.x}
                    y2={p.y + 4}
                    stroke="#666"
                    strokeWidth={0.5}
                  />
                </G>
              );
            }
            return null;
          }),
        )}

        {/* Etiquetas Grilla */}
        {gridLinesX.map((x, i) => {
          if (i % 2 !== 0) return null;
          const p = toPaper(x, gridLinesY[0]);
          return (
            <Text
              key={`lx-${x}`}
              x={p.x}
              y={VIEWPORT_H - 5}
              style={{ fontSize: 5, fill: "#444" }}
              textAnchor="middle"
            >
              {x.toFixed(0)}E
            </Text>
          );
        })}
        {gridLinesY.map((y, i) => {
          if (i % 2 !== 0) return null;
          const p = toPaper(gridLinesX[0], y);
          return (
            <Text
              key={`ly-${y}`}
              x={5}
              y={p.y}
              style={{ fontSize: 5, fill: "#444" }}
              textAnchor="start"
            >
              {y.toFixed(0)}N
            </Text>
          );
        })}

        {/* Contexto Vecindad */}
        {validContextVecinos.map((vecino, index) => {
          const pathDataContext =
            vecino.vertices
              .map((v, i) => {
                const p = toPaper(v.x, v.y);
                return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
              })
              .join(" ") + " Z";

          const ctxCx =
            vecino.vertices.reduce((acc, v) => acc + v.x, 0) /
            vecino.vertices.length;
          const ctxCy =
            vecino.vertices.reduce((acc, v) => acc + v.y, 0) /
            vecino.vertices.length;
          const ctxCentroid = toPaper(ctxCx, ctxCy);

          return (
            <G key={`ctx-${index}`}>
              <Path
                d={pathDataContext}
                fill="none"
                stroke="#d1d5db"
                strokeWidth={1}
              />
              <Text
                x={ctxCentroid.x}
                y={ctxCentroid.y}
                style={{ fontSize: 6, fill: "#666" }}
                textAnchor="middle"
              >
                {vecino.nombre}
              </Text>
            </G>
          );
        })}

        {/* Lotes Adyacentes */}
        {lotesAdyacentes.map((lote, index) => {
          const pathDataAdyacente =
            lote.vertices
              .map((v, i) => {
                const p = toPaper(v.x, v.y);
                return `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`;
              })
              .join(" ") + " Z";

          const cx =
            lote.vertices.reduce((acc, v) => acc + v.x, 0) /
            lote.vertices.length;
          const cy =
            lote.vertices.reduce((acc, v) => acc + v.y, 0) /
            lote.vertices.length;
          const centroid = toPaper(cx, cy);

          return (
            <G key={`adyacente-${index}`}>
              <Path
                d={pathDataAdyacente}
                fill="none"
                stroke="#999"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <Text
                x={centroid.x}
                y={centroid.y}
                style={{ fontSize: 6, fill: "#666" }}
                textAnchor="middle"
              >
                {lote.id}
              </Text>
            </G>
          );
        })}

        {/* Polígono */}
        <Path d={pathData} fill="#eeeeee" stroke="#000" strokeWidth={1.5} />

        {/* Etiqueta Central Área/Perímetro */}
        {/* <G>
          <Rect 
            x={centroid.x - 50} 
            y={centroid.y - 10} 
            width={100} 
            height={20} 
            fill="white" 
            stroke="#000" 
            strokeWidth={0.5} 
          />
          <Text x={centroid.x} y={centroid.y - 2} style={{ fontSize: 5, fontWeight: 'bold' }} textAnchor="middle">
            ÁREA = {area.toFixed(2)} m²
          </Text>
          <Text x={centroid.x} y={centroid.y + 5} style={{ fontSize: 5, fontWeight: 'bold' }} textAnchor="middle">
            PERÍMETRO = {perimetro.toFixed(2)} ml
          </Text>
        </G> */}

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
              <Path
                d={arcPath}
                stroke="#666"
                strokeWidth={0.5}
                strokeDasharray="2,2"
                fill="none"
              />
              <Text
                x={p.x + 15}
                y={p.y - 10}
                style={{ fontSize: 5, fill: "#666" }}
              >
                {decimalToDMSShort(anguloVal)}
              </Text>

              {/* Vértice */}
              <Circle
                cx={p.x}
                cy={p.y}
                r={2}
                fill="white"
                stroke="#000"
                strokeWidth={0.5}
              />
              <Text
                x={p.x + 3}
                y={p.y - 3}
                style={{ fontSize: 6, fontWeight: "bold" }}
              >
                {v.id}
              </Text>

              {/* Distancia Lado */}
              <Rect
                x={midX - 10}
                y={midY - 4}
                width={20}
                height={8}
                fill="white"
              />
              <Text
                x={midX}
                y={midY}
                style={{ fontSize: 5 }}
                textAnchor="middle"
              >
                {distVal}m
              </Text>
            </G>
          );
        })}

        {/* Norte */}
        <G transform={`translate(${VIEWPORT_W - 50}, 50)`}>
          <Line x1={0} y1={-20} x2={0} y2={20} stroke="black" strokeWidth={1} />
          <Path d="M 0 -20 L -3 -10 L 3 -10 Z" fill="black" />
          <Text x={-3} y={-25} style={{ fontSize: 10, fontWeight: "bold" }}>
            N
          </Text>
        </G>
      </Svg>
    </View>
  );
};

export default DrawingVectorial;
