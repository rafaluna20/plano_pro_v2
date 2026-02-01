# ✅ Checklist de Pruebas QA - Sistema Híbrido de Planos

**Fecha**: 2026-01-31  
**Sistema**: Generación Híbrida de Planos Perimétricos V2  
**Endpoint**: `POST /api/v1/planos/generar-hibrido`

---

## 📋 Preparación del Entorno

### 1. Verificar que el servidor está corriendo
```bash
npm run dev
# O
yarn dev
```

El servidor debe estar disponible en `http://localhost:3000`

### 2. Herramientas necesarias
- **Cliente HTTP**: Postman, Insomnia, curl, o Thunder Client (VS Code)
- **Visor PDF**: Cualquier visor de PDF (Adobe Reader, navegador, etc.)
- **Payloads de prueba**: [`tests/qa/payloads-prueba-hibrido.json`](tests/qa/payloads-prueba-hibrido.json)

---

## 🧪 ESCENARIO 1: Happy Path (Datos Registrales)

### Descripción
Prueba el flujo completo con datos registrales explícitos. El sistema debe **priorizar el texto registral** sobre cualquier cálculo geométrico.

### Payload
Usar: `escenario_1_happy_path_registral` de [`payloads-prueba-hibrido.json`](tests/qa/payloads-prueba-hibrido.json)

### Pasos de Ejecución

#### Opción A: Con curl
```bash
curl -X POST http://localhost:3000/api/v1/planos/generar-hibrido \
  -H "Content-Type: application/json" \
  -d @tests/qa/payloads-prueba-hibrido.json \
  --output test-registral.pdf
```

#### Opción B: Con Postman/Insomnia
1. Método: `POST`
2. URL: `http://localhost:3000/api/v1/planos/generar-hibrido`
3. Headers: `Content-Type: application/json`
4. Body: Copiar `escenario_1_happy_path_registral` completo
5. Send
6. Save response as `test-registral.pdf`

### Criterios de Aceptación

#### ✅ Verificaciones del PDF
- [ ] **Cota del lado FRENTE muestra "10.00m"** (texto registral)
  - Aunque las coordenadas geométricas muestran ~9.98m
  - El texto registral DEBE prevalecer
  
- [ ] **Cuadro Técnico tiene columna "COLINDANCIA"**
  - Fila V1-V2: Muestra "Av. Los Alamos"
  - Fila V2-V3: Muestra "Lote 6"
  - Fila V3-V4: Muestra "Lote 4"
  - Fila V4-V1: Muestra "Pasaje Comercio"

- [ ] **Área Final = 199.60 m²** (del registro)
  - Etiqueta central del lote
  - Membrete profesional

- [ ] **Perímetro Final = 59.96 ml** (del registro)
  - Etiqueta central del lote
  - Membrete profesional

- [ ] **Plano de Ubicación tiene auto-scale**
  - Debe mostrar "E 1:XXXX" en el título
  - El lote principal está centrado
  - Contexto visible alrededor

#### ✅ Verificaciones de Headers HTTP
- [ ] `Content-Type: application/pdf`
- [ ] `X-Data-Source-Area: REGISTRAL`
- [ ] `X-Data-Source-Perimeter: REGISTRAL`
- [ ] `X-Data-Source-Linderos: REGISTRAL`
- [ ] `X-Requires-Review: false` (no hay discrepancias)
- [ ] `X-Warnings-Count: 0` (o bajo número)

### Resultado Esperado
✅ **ÉXITO**: PDF generado con texto registral "10.00m" en el frente, sin errores.

---

## 🧪 ESCENARIO 2: Fallback Geométrico (Cálculo Automático)

### Descripción
Prueba el modo fallback cuando NO hay datos registrales. El sistema debe **calcular todo automáticamente** desde la geometría y **detectar colindancias con Turf.js**.

### Payload
Usar: `escenario_2_fallback_geometrico` de [`payloads-prueba-hibrido.json`](tests/qa/payloads-prueba-hibrido.json)

Nota: Este payload tiene:
```json
"datosRegistrales": {
  "areaOficial": null,
  "perimetroOficial": null,
  "linderos": null
}
```

### Pasos de Ejecución

#### Opción A: Con curl
```bash
curl -X POST http://localhost:3000/api/v1/planos/generar-hibrido \
  -H "Content-Type: application/json" \
  -d '{"meta": {...}, "loteObjetivo": {...}, "datosRegistrales": {"areaOficial": null, "perimetroOficial": null, "linderos": null}, ...}' \
  --output test-fallback.pdf
```

#### Opción B: Con Postman/Insomnia
1. Método: `POST`
2. URL: `http://localhost:3000/api/v1/planos/generar-hibrido`
3. Headers: `Content-Type: application/json`
4. Body: Copiar `escenario_2_fallback_geometrico` completo
5. Send
6. Save response as `test-fallback.pdf`

### Criterios de Aceptación

#### ✅ Verificaciones del PDF
- [ ] **Cotas calculadas automáticamente**
  - Lado V1-V2: ~15.00m (calculado desde coordenadas)
  - Lado V2-V3: ~20.00m
  - Lado V3-V4: ~15.00m
  - Lado V4-V1: ~20.00m

- [ ] **Colindancia detectada automáticamente**
  - Debe aparecer "Av. Los Alamos" en al menos UN lado
  - Usar raycasting con `turf.buffer()` + `turf.booleanIntersects()`
  - Si no detecta, debe mostrar "Colindancia no determinada"

- [ ] **Área calculada desde geometría**
  - Área ≈ 300 m² (15m × 20m)
  - Calculada con `turf.area()`

- [ ] **Perímetro calculado desde geometría**
  - Perímetro ≈ 70 ml (2×15 + 2×20)
  - Calculado con `turf.length()`

#### ✅ Verificaciones de Headers HTTP
- [ ] `Content-Type: application/pdf`
- [ ] `X-Data-Source-Area: CALCULADO`
- [ ] `X-Data-Source-Perimeter: CALCULADO`
- [ ] `X-Data-Source-Linderos: CALCULADO`
- [ ] `X-Requires-Review: false`
- [ ] `X-Warnings-Count: >=0`

### Resultado Esperado
✅ **ÉXITO**: PDF generado con datos calculados automáticamente, detección de "Av. Los Alamos".

---

## 🧪 ESCENARIO 3: Error de Integridad (Validación)

### Descripción
Prueba el manejo de errores cuando hay **incoherencia** entre el número de lados del polígono y el número de linderos registrales.

**Geometría**: Polígono de 4 lados (cuadrado)  
**Linderos**: Array con 5 elementos ❌

### Payload
Usar: `escenario_3_error_integridad` de [`payloads-prueba-hibrido.json`](tests/qa/payloads-prueba-hibrido.json)

### Pasos de Ejecución

#### Opción A: Con curl
```bash
curl -X POST http://localhost:3000/api/v1/planos/generar-hibrido \
  -H "Content-Type: application/json" \
  -d @tests/qa/escenario-error.json \
  -v
```

#### Opción B: Con Postman/Insomnia
1. Método: `POST`
2. URL: `http://localhost:3000/api/v1/planos/generar-hibrido`
3. Headers: `Content-Type: application/json`
4. Body: Copiar `escenario_3_error_integridad` completo
5. Send
6. **NO debería generar PDF**, debe retornar JSON de error

### Criterios de Aceptación

#### ✅ Verificaciones de Respuesta
- [ ] **Status Code: 400 Bad Request**
  - NO debe ser 500 (Internal Server Error)
  - NO debe ser 200 (Success)

- [ ] **Response Content-Type: application/json**
  - NO debe ser `application/pdf`

- [ ] **JSON de error con estructura correcta**
```json
{
  "success": false,
  "error": {
    "code": "PROCESSING_ERROR",
    "message": "Error durante el procesamiento de datos",
    "details": "ADVERTENCIA: Número de linderos registrales (5) no coincide con lados del polígono (4). Usando cálculo geométrico."
  }
}
```

- [ ] **Servidor NO se cuelga**
  - El servidor debe seguir funcionando
  - Debe poder procesar nuevas solicitudes
  - No debe haber crash ni timeout

- [ ] **Log en consola del servidor**
```
[TEST-ERROR-003] Iniciando procesamiento híbrido...
ADVERTENCIA: Número de linderos registrales (5) no coincide con lados del polígono (4)
```

#### ✅ Verificación de Comportamiento Alternativo
El procesador debe **forzar fallback** a cálculo geométrico:
```typescript
// En PlanoDataProcessor.ts línea ~176
if (numLinderos !== numLados) {
  this.warnings.push(
    `ADVERTENCIA: Número de linderos registrales (${numLinderos}) no coincide con lados del polígono (${numLados}). Usando cálculo geométrico.`
  );
  // Forzar recálculo
  this.payload.datosRegistrales.linderos = null;
}
```

### Resultado Esperado
✅ **ÉXITO**: Error 400 con mensaje claro, servidor NO se cuelga, fallback a modo geométrico.

---

## 📊 Resumen de Resultados

### Tabla de Verificación

| Escenario | Status | Tiempo (ms) | PDF Generado | Headers Correctos | Observaciones |
|-----------|--------|-------------|--------------|-------------------|---------------|
| 1. Happy Path Registral | ⬜ | ___ | ⬜ Sí / ⬜ No | ⬜ Sí / ⬜ No | _______________ |
| 2. Fallback Geométrico | ⬜ | ___ | ⬜ Sí / ⬜ No | ⬜ Sí / ⬜ No | _______________ |
| 3. Error de Integridad | ⬜ | ___ | ⬜ No (Correcto) | ⬜ Sí / ⬜ No | _______________ |

### Leyenda
- ✅ = Pasó
- ❌ = Falló
- ⚠️ = Pasó con warnings
- ⬜ = No probado

---

## 🐛 Debugging: Problemas Comunes

### Problema 1: Error "DatosProcesados no exportado"
**Síntoma**: TypeScript error al compilar
```
Module '@/types/PlanosPayload' has no exported member 'DatosProcesados'
```

**Solución**: Verificar que el import sea:
```typescript
import type { DatosProcesados } from '@/lib/services/PlanoDataProcessor';
```

### Problema 2: PDF vacío o corrupto
**Síntoma**: PDF no se puede abrir
**Causas posibles**:
1. Error en `jsPDF.output('arraybuffer')`
2. Headers mal configurados
3. Error no capturado en generación

**Debug**:
```typescript
console.log('PDF Buffer length:', pdfBuffer.length);
console.log('First bytes:', pdfBuffer.slice(0, 10));
// Debe empezar con: [37, 80, 68, 70] = "%PDF"
```

### Problema 3: Colindancias no detectadas
**Síntoma**: Cuadro técnico muestra "Colindancia no determinada"
**Causas posibles**:
1. `BUFFER_DETECTION_RADIUS` muy pequeño (default 0.1m)
2. Coordenadas no coinciden espacialmente
3. Features del contexto mal formadas

**Debug**:
```typescript
// En PlanoDataProcessor.ts, línea ~315
console.log('Buffer:', buffered);
console.log('Intersects:', turf.booleanIntersects(buffered, feature.geometry));
```

### Problema 4: Discrepancias falsas
**Síntoma**: `X-Requires-Review: true` cuando no debería
**Causa**: Tolerancia de 2% muy estricta

**Solución temporal**: Aumentar tolerancia en PlanoDataProcessor.ts:
```typescript
const TOLERANCE_PERCENTAGE = 0.05; // 5% en vez de 2%
```

---

## 📝 Notas Adicionales

### Datos de Prueba Personalizados
Para crear tus propios payloads de prueba:

1. Copiar estructura de [`payloads-prueba-hibrido.json`](tests/qa/payloads-prueba-hibrido.json)
2. Modificar coordenadas manteniendo formato `[x, y]` en UTM
3. Asegurar que el primer y último punto del polígono sean iguales (cierre)
4. Coordenadas de ejemplo (Lima):
   - X: 276000 - 277000 (Este)
   - Y: 8664000 - 8665000 (Norte)
   - Zona: 18L (WGS84 UTM)

### Validación Previa del Payload
Antes de enviar a la API, validar con:
```bash
# Validar JSON syntax
cat tests/qa/payloads-prueba-hibrido.json | jq .

# Extraer escenario específico
cat tests/qa/payloads-prueba-hibrido.json | jq '.escenario_1_happy_path_registral' > test1.json
```

### Logs del Servidor
Monitorear la consola del servidor durante las pruebas:
```
[TEST-REGISTRAL-001] Iniciando procesamiento híbrido...
[TEST-REGISTRAL-001] Procesamiento completado: { areaFinal: 199.6, fuenteArea: 'REGISTRAL', warnings: 0 }
[TEST-REGISTRAL-001] Generando PDF...
[TEST-REGISTRAL-001] PDF generado exitosamente en 1245ms
```

---

## ✅ Firma de Aprobación

| Rol | Nombre | Fecha | Firma |
|-----|--------|-------|-------|
| QA Tester | _____________ | ____/____/____ | _________ |
| Developer | _____________ | ____/____/____ | _________ |
| Tech Lead | _____________ | ____/____/____ | _________ |

---

**Versión del Checklist**: 1.0  
**Última actualización**: 2026-01-31  
**Sistema**: Planos Perimétricos Híbridos V2
