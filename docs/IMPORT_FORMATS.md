# Formatos de Importación de Datos

Este documento describe los formatos de archivo compatibles para la importación de coordenadas UTM (Zona 18S) en el Editor de Catastro.

## Formatos Soportados

### 1. CSV (.csv)
Es el formato más común. Permite columnas separadas por coma `,`, punto y coma `;` o tabulaciones.

**Estructura:**
- Puede incluir una línea de encabezado (opcional).
- Columnas esperadas: **X (Este)** y **Y (Norte)** en ese orden.

**Ejemplo:**
```csv
x,y
284500.00,8670100.00
284510.00,8670100.00
284510.00,8670080.00
284500.00,8670080.00
```

---

### 2. GeoJSON (.json, .geojson)
Formato estándar para datos geográficos. Se extraen coordenadas de geometrías de tipo `Polygon`, `LineString` o `Point`.

**Ejemplo (Polygon):**
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [
      [
        [284500.0, 8670100.0],
        [284510.0, 8670100.0],
        [284510.0, 8670080.0],
        [284500.0, 8670080.0],
        [284500.0, 8670100.0]
      ]
    ]
  }
}
```

---

### 3. KML (.kml)
Formato de Google Earth. Extrae las coordenadas de elementos `<Polygon>` o `<LineString>`.

**Estructura:**
- Las coordenadas dentro de `<coordinates>` deben estar separadas por espacios.
- Formato interno: `lon,lat,alt` (aunque el sistema las interpreta como X,Y UTM).

**Ejemplo:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <Polygon>
      <outerBoundaryIs>
        <LinearRing>
          <coordinates>
            284500,8670100,0 284510,8670100,0 284510,8670080,0 284500,8670080,0 284500,8670100,0
          </coordinates>
        </LinearRing>
      </outerBoundaryIs>
    </Polygon>
  </Placemark>
</kml>
```

---

### 4. Texto Plano (.txt)
Formato simple con una coordenada por línea.

**Estructura:**
- Una pareja de coordenadas por línea separadas por espacio o tabulación.

**Ejemplo:**
```text
284500.00 8670100.00
284510.00 8670100.00
284510.00 8670080.00
284500.00 8670080.00
```

---

## Notas Importantes

> [!IMPORTANT]
> **Sistema de Coordenadas:** El sistema está diseñado para coordenadas **UTM WGS84 - Zona 18S** (común en Perú).
> - **X (Este):** Valores típicos entre 100,000 y 900,000.
> - **Y (Norte):** Valores típicos entre 8,000,000 y 9,500,000.

> [!TIP]
> **Vértices Mínimos:** Se requieren al menos **3 vértices** para que el sistema pueda generar un polígono válido para el plano.

> [!WARNING]
> En archivos CSV, asegúrate de que el separador decimal sea el punto `.` y no la coma `,`, especialmente si usas la coma como separador de columnas.
