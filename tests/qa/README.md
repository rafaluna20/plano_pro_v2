# 🧪 Sistema de Pruebas QA - Planos Híbridos V2

Sistema completo de testing para la generación híbrida de planos perimétricos con prioridad registral y fallback geométrico.

---

## 📁 Estructura de Archivos

```
tests/qa/
├── README.md                          # Este archivo
├── CHECKLIST_PRUEBAS_HIBRIDO.md      # Checklist detallado de QA
├── POSTMAN_GUIDE.md                   # Guía completa de Postman
├── payloads-prueba-hibrido.json      # 3 payloads de prueba (referencia)
├── postman-collection.json            # Colección para importar en Postman
├── run-tests.sh                       # Script automatizado (Linux/Mac)
├── run-tests.ps1                      # Script automatizado (Windows)
└── output/                            # PDFs y resultados generados
    ├── test1-registral.pdf
    ├── test2-fallback.pdf
    └── test3-error.json
```

---

## 🚀 Quick Start

### Opción 1: Scripts Automatizados (Recomendado)

**Linux/Mac**:
```bash
chmod +x tests/qa/run-tests.sh
./tests/qa/run-tests.sh
```

**Windows PowerShell**:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\tests\qa\run-tests.ps1
```

### Opción 2: Manual con curl

**Escenario 1 - Happy Path**:
```bash
curl -X POST http://localhost:3000/api/v1/planos/generar-hibrido \
  -H "Content-Type: application/json" \
  -d @tests/qa/payloads-prueba-hibrido.json \
  --output test-registral.pdf
```

**Escenario 2 - Fallback**:
```bash
cat tests/qa/payloads-prueba-hibrido.json | jq '.escenario_2_fallback_geometrico' | \
curl -X POST http://localhost:3000/api/v1/planos/generar-hibrido \
  -H "Content-Type: application/json" \
  -d @- \
  --output test-fallback.pdf
```

**Escenario 3 - Error**:
```bash
cat tests/qa/payloads-prueba-hibrido.json | jq '.escenario_3_error_integridad' | \
curl -X POST http://localhost:3000/api/v1/planos/generar-hibrido \
  -H "Content-Type: application/json" \
  -d @- \
  -v
```

### Opción 3: Con Postman (Recomendado para QA Manual)

**Importar colección**:
```
1. Abrir Postman
2. Click "Import"
3. Seleccionar: tests/qa/postman-collection.json
4. Click "Import"
```

**Ejecutar tests**:
1. Seleccionar request (Escenario 1, 2 o 3)
2. Click "Send"
3. Ver tab "Test Results" - Los tests se ejecutan automáticamente
4. Guardar PDFs con "Save Response" → "Save to file"

**Ver guía completa**: [`POSTMAN_GUIDE.md`](POSTMAN_GUIDE.md)

### Opción 4: Manual con Insomnia

Similar a Postman, puedes crear requests manualmente desde [`payloads-prueba-hibrido.json`](payloads-prueba-hibrido.json)

---

## 📋 Escenarios de Prueba

### 🟢 Escenario 1: Happy Path (Datos Registrales)

**Objetivo**: Verificar que el texto registral prevalece sobre la geometría

**Payload**: `escenario_1_happy_path_registral`

**Qué verifica**:
- ✅ PDF muestra "10.00m" en lado FRENTE (dato registral)
- ✅ Cuadro técnico tiene columna "COLINDANCIA"
- ✅ Área = 199.60 m² (del registro)
- ✅ Perímetro = 59.96 ml (del registro)
- ✅ Headers HTTP indican `X-Data-Source-Area: REGISTRAL`

**Resultado esperado**: Status 200, PDF válido

---

### 🔵 Escenario 2: Fallback Geométrico

**Objetivo**: Verificar cálculo automático cuando NO hay datos registrales

**Payload**: `escenario_2_fallback_geometrico`

**Qué verifica**:
- ✅ Sistema calcula área desde geometría (~300 m²)
- ✅ Sistema calcula linderos automáticamente
- ✅ **Detección automática** de colindancia "Av. Los Alamos" (con Turf.js)
- ✅ Headers HTTP indican `X-Data-Source-Area: CALCULADO`
- ✅ Headers HTTP indican `X-Data-Source-Linderos: CALCULADO`

**Resultado esperado**: Status 200, PDF con cálculos automáticos

---

### 🔴 Escenario 3: Error de Integridad

**Objetivo**: Verificar manejo de errores y validación

**Payload**: `escenario_3_error_integridad`

**Qué verifica**:
- ✅ Status Code = 400 (no 500, no 200)
- ✅ Respuesta es JSON con estructura de error
- ✅ Mensaje de error es claro y descriptivo
- ✅ Servidor NO se cuelga
- ✅ Sistema detecta incoherencia: 4 lados vs 5 linderos

**Resultado esperado**: Status 400, JSON de error, servidor sigue funcionando

---

## 📊 Interpretación de Resultados

### Headers HTTP Importantes

```http
X-Data-Source-Area: REGISTRAL | CALCULADO
X-Data-Source-Perimeter: REGISTRAL | CALCULADO
X-Data-Source-Linderos: REGISTRAL | CALCULADO | MIXTO
X-Requires-Review: true | false
X-Warnings-Count: 0-N
X-Generation-Time: XXXms
```

### Significado de Headers

| Header | Valor | Significado |
|--------|-------|-------------|
| `X-Data-Source-Area` | `REGISTRAL` | Área tomada del registro oficial |
| `X-Data-Source-Area` | `CALCULADO` | Área calculada con Turf.js desde geometría |
| `X-Requires-Review` | `true` | Discrepancia > 2% entre registro y cálculo |
| `X-Warnings-Count` | `> 0` | Hay advertencias (ver respuesta o logs) |

### Validación de PDF

**PDF válido debe**:
1. Abrirse sin errores en cualquier visor
2. Mostrar marco profesional con doble línea
3. Tener cuadro técnico con 6 columnas
4. Mostrar plano de ubicación con escala
5. Incluir membrete con datos del lote

**Cómo validar**:
```bash
# Verificar que es PDF válido
file test1-registral.pdf
# Output esperado: "PDF document, version 1.X"

# Verificar tamaño mínimo (debe ser > 10KB)
ls -lh test1-registral.pdf

# Verificar con pdfinfo (si está instalado)
pdfinfo test1-registral.pdf
```

---

## 🐛 Troubleshooting

### Problema: "Servidor no está activo"

**Solución**:
```bash
# Iniciar servidor de desarrollo
npm run dev

# Verificar que esté corriendo
curl http://localhost:3000/api/v1/planos/generar-hibrido
```

### Problema: "jq: command not found" (Linux/Mac)

**Solución**:
```bash
# Ubuntu/Debian
sudo apt-get install jq

# macOS
brew install jq
```

### Problema: "PDF corrupto o vacío"

**Causas posibles**:
1. Error no capturado en generación
2. Falta instalar dependencia `jspdf`
3. Memoria insuficiente

**Debug**:
```bash
# Ver logs del servidor
npm run dev

# Verificar que jsPDF está instalado
npm list jspdf

# Ver tamaño del PDF
ls -lh output/test1-registral.pdf
```

### Problema: "Colindancias no detectadas"

**Causa**: Buffer de detección muy pequeño (0.1m) o coordenadas no coinciden

**Solución temporal**:
Editar [`lib/services/PlanoDataProcessor.ts`](../../lib/services/PlanoDataProcessor.ts:30):
```typescript
// Aumentar radio de buffer
const BUFFER_DETECTION_RADIUS = 0.5; // en vez de 0.1
```

### Problema: "Script run-tests.sh no ejecuta"

**Solución**:
```bash
# Dar permisos de ejecución
chmod +x tests/qa/run-tests.sh

# Ejecutar
./tests/qa/run-tests.sh
```

---

## 📚 Documentación Relacionada

- **Checklist Detallado**: [`CHECKLIST_PRUEBAS_HIBRIDO.md`](CHECKLIST_PRUEBAS_HIBRIDO.md)
- **Tipos TypeScript**: [`types/PlanosPayload.ts`](../../types/PlanosPayload.ts)
- **Procesador Híbrido**: [`lib/services/PlanoDataProcessor.ts`](../../lib/services/PlanoDataProcessor.ts)
- **Generador V2**: [`lib/generators/PlanoPerimetricoGeneratorV2.ts`](../../lib/generators/PlanoPerimetricoGeneratorV2.ts)
- **Endpoint API**: [`app/api/v1/planos/generar-hibrido/route.ts`](../../app/api/v1/planos/generar-hibrido/route.ts)

---

## 🎯 Checklist Rápido

Antes de dar aprobación QA, verificar:

- [ ] Escenario 1 pasa: PDF muestra "10.00m" en frente
- [ ] Escenario 2 pasa: Detecta "Av. Los Alamos" automáticamente
- [ ] Escenario 3 pasa: Error 400, no 500, servidor sigue vivo
- [ ] Headers HTTP correctos en todos los casos
- [ ] PDFs se abren sin errores
- [ ] Tiempo de generación < 5 segundos
- [ ] No hay memory leaks (ejecutar 10 veces)
- [ ] Logs del servidor sin errores críticos

---

## 🔬 Testing Avanzado

### Pruebas de Carga

```bash
# Generar 10 PDFs consecutivos
for i in {1..10}; do
  curl -X POST http://localhost:3000/api/v1/planos/generar-hibrido \
    -H "Content-Type: application/json" \
    -d @tests/qa/payloads-prueba-hibrido.json \
    --output "test-$i.pdf" &
done
wait
```

### Pruebas de Tolerancia

Modificar payload para probar discrepancias:
```json
{
  "datosRegistrales": {
    "areaOficial": 200.00,  // Área registral
    // Geometría real: ~195 m² (discrepancia: 2.5%)
  }
}
```

Debe retornar `X-Requires-Review: true` si discrepancia > 2%

### Pruebas de Geometrías Complejas

Probar con:
- Polígonos de 5+ lados
- Lotes en esquina
- Lotes con curvas (aproximadas)
- Lotes muy pequeños (< 50 m²)
- Lotes muy grandes (> 1000 m²)

---

## 📝 Reportar Bugs

Si encuentras un bug, reporta con:

1. **Escenario**: ¿Cuál de los 3 escenarios?
2. **Payload**: JSON completo enviado
3. **Respuesta**: Status code y body
4. **Headers**: Especialmente `X-*` headers
5. **Logs**: Consola del servidor
6. **PDF**: Si se generó, adjuntar
7. **Comportamiento esperado**: ¿Qué debería pasar?
8. **Comportamiento actual**: ¿Qué pasó?

**Formato de reporte**:
```markdown
## Bug: [Título breve]

**Escenario**: Escenario 1 - Happy Path
**Status Code**: 500 (esperado: 200)
**Error**: "Cannot read property 'longitudTexto' of undefined"

**Payload**:
```json
{...}
```

**Logs del servidor**:
```
[ERROR] TypeError: Cannot read property...
```

**Pasos para reproducir**:
1. ...
2. ...
```

---

## ✅ Aprobación Final

Firma aquí cuando todas las pruebas pasen:

**QA Tester**: _____________  
**Fecha**: ____/____/____  
**Versión probada**: V2.0.0  
**Resultado**: ✅ APROBADO / ❌ RECHAZADO

---

**Última actualización**: 2026-01-31  
**Versión del sistema de pruebas**: 1.0  
**Mantenedor**: Sistema QA - Planos Híbridos V2
