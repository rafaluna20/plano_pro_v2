"""
Servicio de generación de DXF para Planos Pro.

Recibe la geometría de un lote (ya resuelta y validada por el llamador —
plan_pro) y produce un archivo DXF en coordenadas UTM reales (model space),
apto para importar directamente en AutoCAD/Civil3D. No conoce nada de la
base de datos ni de autenticación de usuarios: es un servicio de traducción
puro, geometría de entrada -> archivo DXF de salida.
"""

from typing import List, Optional, Tuple

import ezdxf
from ezdxf import units
from ezdxf.enums import TextEntityAlignment
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

app = FastAPI(title="Planos Pro - DXF Service", version="1.0.0")

Point = Tuple[float, float]


class Colindancia(BaseModel):
    lado: str
    tipo: str
    nombre: str
    longitud: Optional[float] = None


class ElementoContexto(BaseModel):
    tipo: Optional[str] = "LOTE"
    codigo: Optional[str] = None
    texto: Optional[str] = None
    vertices: List[Point]


class LoteMetadata(BaseModel):
    codigo: str
    nombre: str
    manzana: str
    etapa: str
    numeroLote: str


class GenerarDxfRequest(BaseModel):
    vertices: List[Point] = Field(..., min_length=3)
    lote: LoteMetadata
    colindancias: List[Colindancia] = []
    contexto_elementos: List[ElementoContexto] = []


def _add_text(msp, text: str, pos: Point, height: float, layer: str) -> None:
    entity = msp.add_text(text, dxfattribs={"layer": layer, "height": height})
    entity.set_placement(pos, align=TextEntityAlignment.LEFT)


def _distancia(a: Point, b: Point) -> float:
    return ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5


def _centroide(vertices: List[Point]) -> Point:
    n = len(vertices)
    return (sum(p[0] for p in vertices) / n, sum(p[1] for p in vertices) / n)


def build_dxf(payload: GenerarDxfRequest) -> bytes:
    doc = ezdxf.new(dxfversion="R2010", setup=True)
    doc.header["$INSUNITS"] = units.M  # coordenadas reales en metros (UTM), sin transformar a papel

    doc.layers.add(name="LOTE", color=1)     # rojo
    doc.layers.add(name="VECINOS", color=8)  # gris
    doc.layers.add(name="TEXTOS", color=7)   # blanco/negro
    doc.layers.add(name="COTAS", color=3)    # verde

    msp = doc.modelspace()
    vertices = payload.vertices

    # Polígono cerrado del lote
    msp.add_lwpolyline(
        vertices + [vertices[0]],
        dxfattribs={"layer": "LOTE", "closed": True},
    )

    # Etiquetas de vértice (A, B, C...) y distancia de cada lado
    labels = [chr(65 + i) if i < 26 else str(i) for i in range(len(vertices))]
    for i, (x, y) in enumerate(vertices):
        _add_text(msp, labels[i], (x + 0.3, y + 0.3), height=0.5, layer="TEXTOS")

        nxt = vertices[(i + 1) % len(vertices)]
        dist = _distancia((x, y), nxt)
        mid = ((x + nxt[0]) / 2, (y + nxt[1]) / 2)
        _add_text(msp, f"{dist:.2f} m", mid, height=0.4, layer="COTAS")

    # Contexto: lotes/elementos vecinos, como referencia en capa aparte
    for elem in payload.contexto_elementos:
        if len(elem.vertices) < 3:
            continue
        msp.add_lwpolyline(
            elem.vertices + [elem.vertices[0]],
            dxfattribs={"layer": "VECINOS", "closed": True},
        )
        if elem.texto:
            _add_text(msp, elem.texto, _centroide(elem.vertices), height=0.4, layer="VECINOS")

    # Título de referencia sobre el dibujo
    min_x = min(p[0] for p in vertices)
    max_y = max(p[1] for p in vertices)
    titulo = f"{payload.lote.codigo} - MZ {payload.lote.manzana} - LOTE {payload.lote.numeroLote}"
    _add_text(msp, titulo, (min_x, max_y + 2), height=0.8, layer="TEXTOS")

    return _write_bytes(doc)


def _write_bytes(doc) -> bytes:
    import io

    buffer = io.StringIO()
    doc.write(buffer)
    return buffer.getvalue().encode("utf-8")


@app.get("/health")
def health():
    return {"status": "ok", "service": "dxf-service"}


@app.post("/generate-dxf")
def generate_dxf(payload: GenerarDxfRequest):
    try:
        dxf_bytes = build_dxf(payload)
    except Exception as exc:  # noqa: BLE001 - queremos devolver el motivo real al llamador
        raise HTTPException(status_code=400, detail=f"Error generando DXF: {exc}") from exc

    filename = f"plano_{payload.lote.codigo}.dxf"
    return Response(
        content=dxf_bytes,
        media_type="application/dxf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
