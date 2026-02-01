# 📮 Guía de Postman - Planos Híbridos V2

Guía completa para usar la colección de Postman con los tests del sistema híbrido.

---

## 🚀 Quick Start

### 1. Importar la Colección

**Opción A: Desde archivo local**
```
1. Abrir Postman
2. Click en "Import" (esquina superior izquierda)
3. Arrastrar el archivo "postman-collection.json" o click "Upload Files"
4. Seleccionar: tests/qa/postman-collection.json
5. Click "Import"
```

**Opción B: Desde URL (si tienes el archivo en GitHub)**
```
1. Click en "Import"
2. Seleccionar tab "Link"
3. Pegar URL del archivo postman-collection.json
4. Click "Continue" → "Import"
```

### 2. Verificar la Importación

Deberías ver una colección llamada:
```
📁 Planos Híbridos V2 - QA Tests
  ├── 📄 Escenario 1: Happy Path (Registral)
  ├── 📄 Escenario 2: Fallback Geométrico
  ├── 📄 Escenario 3: Error de Integridad
  └── 📄 GET - Info de la API
```

---

## 📋 Estructura de la Colección

### Variables de Entorno

La colección incluye variables globales:

| Variable | Valor | Descripción |
|----------|-------|-------------|
| `baseUrl` | `http://localhost:3000` | URL base del servidor |
| `apiPath` | `/api/v1/planos/generar-hibrido` | Path del endpoint |

**Para modificarlas**:
1. Click derecho en la colección
2. "Edit"
3. Tab "Variables"
4. Modificar valores según tu entorno

---

## 🧪 Ejecutar los Tests

### Opción 1: Tests Individuales

**Escenario 1 - Happy Path**:
1. Seleccionar request "Escenario 1: Happy Path (Registral)"
2. Click "Send"
3. En tab "Test Results" verás:
   - ✅ Status code is 200
   - ✅ Content-Type is PDF
   - ✅ Data source is REGISTRAL
   - ✅ Does not require review

4. Para descargar el PDF:
   - Click en "Save Response" → "Save to file"
   - Guardar como `test1-registral.pdf`

**Escenario 2 - Fallback**:
1. Seleccionar request "Escenario 2: Fallback Geométrico"
2. Click "Send"
3. Verificar tests automáticos
4. Guardar PDF como `test2-fallback.pdf`

**Escenario 3 - Error**:
1. Seleccionar request "Escenario 3: Error de Integridad"
2. Click "Send"
3. Verificar que:
   - Status = 400
   - Response es JSON (no PDF)
   - Tests pasan ✅

### Opción 2: Collection Runner (Todos a la vez)

```
1. Click derecho en la colección
2. "Run collection"
3. Seleccionar los 3 escenarios (dejar el GET opcional)
4. Click "Run Planos Híbridos V2 - QA Tests"
5. Ver resumen con 3 tests passed/failed
```

**Ventajas del Collection Runner**:
- Ejecuta todos los tests automáticamente
- Genera reporte visual con gráficos
- Muestra tiempo total de ejecución
- Exporta resultados a JSON/HTML

---

## 📊 Interpretar Resultados

### ✅ Test Pasado

```
✓ Status code is 200
✓ Content-Type is PDF
✓ Data source is REGISTRAL
✓ Does not require review

4/4 tests passed
```

### ❌ Test Fallado

```
✓ Status code is 200
✗ Data source is REGISTRAL
  | AssertionError: expected 'CALCULADO' to equal 'REGISTRAL'

3/4 tests passed
```

**Acción**: Revisar el payload o la implementación del procesador.

### Headers HTTP Importantes

En la respuesta, tab "Headers", buscar:

```
X-Data-Source-Area: REGISTRAL | CALCULADO
X-Data-Source-Perimeter: REGISTRAL | CALCULADO
X-Data-Source-Linderos: REGISTRAL | CALCULADO | MIXTO
X-Requires-Review: true | false
X-Warnings-Count: 0-N
X-Generation-Time: XXXms
```

---

## 🔧 Personalizar Tests

### Agregar Nuevos Tests

Editar script en tab "Tests" de cada request:

```javascript
// Ejemplo: Verificar tiempo de generación
pm.test("Generation time is under 3 seconds", function () {
    const genTime = parseInt(pm.response.headers.get('X-Generation-Time'));
    pm.expect(genTime).to.be.below(3000);
});

// Ejemplo: Verificar tamaño del PDF
pm.test("PDF size is reasonable", function () {
    const size = pm.response.size().body;
    pm.expect(size).to.be.above(10000); // > 10KB
    pm.expect(size).to.be.below(5000000); // < 5MB
});

// Ejemplo: Verificar warnings
pm.test("No warnings generated", function () {
    const warnings = parseInt(pm.response.headers.get('X-Warnings-Count'));
    pm.expect(warnings).to.equal(0);
});
```

### Modificar Payloads

Editar en tab "Body" → "raw":

```json
{
  "datosRegistrales": {
    "areaOficial": 250.00,  // Cambiar valor
    "perimetroOficial": null // Forzar cálculo
  }
}
```

---

## 📦 Exportar Resultados

### Exportar Colección Actualizada

```
1. Click derecho en la colección
2. "Export"
3. Seleccionar formato: "Collection v2.1 (recommended)"
4. Save as: postman-collection-updated.json
```

### Exportar Resultados de Tests

**Desde Collection Runner**:
```
1. Ejecutar Collection Runner
2. Click "Export Results"
3. Seleccionar formato:
   - JSON: Para procesamiento automático
   - HTML: Para reporte visual
```

**Compartir con el equipo**:
- Subir JSON a repositorio
- Enviar HTML por email
- Integrar con CI/CD

---

## 🔗 Integración con Newman (CLI)

Newman es el runner de Postman para línea de comandos.

### Instalación

```bash
npm install -g newman
```

### Ejecutar Colección

```bash
# Básico
newman run tests/qa/postman-collection.json

# Con reporte HTML
newman run tests/qa/postman-collection.json \
  --reporters cli,html \
  --reporter-html-export tests/qa/output/newman-report.html

# Con variables de entorno personalizadas
newman run tests/qa/postman-collection.json \
  --env-var "baseUrl=http://production.example.com"
```

### Integrar con CI/CD

**GitHub Actions**:
```yaml
name: API Tests
on: [push]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Install Newman
        run: npm install -g newman
      - name: Run Tests
        run: newman run tests/qa/postman-collection.json
```

**GitLab CI**:
```yaml
test_api:
  stage: test
  script:
    - npm install -g newman
    - newman run tests/qa/postman-collection.json
```

---

## 🐛 Troubleshooting

### Problema: "Could not get response"

**Causa**: Servidor no está corriendo

**Solución**:
```bash
npm run dev
```

Verificar que el servidor esté en `http://localhost:3000`

### Problema: Tests fallan con "Unexpected token"

**Causa**: Response no es JSON válido (probablemente HTML de error)

**Debug**:
1. Ver tab "Body" de la respuesta
2. Si es HTML, hay un error 404 o 500
3. Verificar la URL del request
4. Revisar logs del servidor

### Problema: PDF corrupto o vacío

**Causa**: Error en generación no capturado

**Debug**:
1. Ver logs del servidor (terminal donde corre `npm run dev`)
2. Verificar que no haya errores de TypeScript
3. Probar con payload más simple:

```json
{
  "meta": {"solicitudId": "TEST-SIMPLE-001"},
  "loteObjetivo": {...geometría mínima...},
  "datosRegistrales": {
    "areaOficial": null,
    "perimetroOficial": null,
    "linderos": null
  },
  "contexto": {"type": "FeatureCollection", "features": []},
  "configImpresion": {}
}
```

### Problema: "SSL Error" en Postman

**Causa**: Certificado SSL autofirmado en desarrollo

**Solución**:
```
1. Settings → General
2. Desactivar "SSL certificate verification"
3. Solo para desarrollo local
```

---

## 📚 Recursos Adicionales

### Documentación Oficial
- [Postman Learning Center](https://learning.postman.com/)
- [Writing Tests in Postman](https://learning.postman.com/docs/writing-scripts/test-scripts/)
- [Newman CLI](https://learning.postman.com/docs/running-collections/using-newman-cli/)

### Ejemplos de Scripts Avanzados

**Pre-request Script** (antes de enviar):
```javascript
// Generar timestamp dinámico
pm.environment.set("timestamp", new Date().toISOString());

// Calcular firma HMAC
const signature = CryptoJS.HmacSHA256("data", "secret").toString();
pm.environment.set("signature", signature);
```

**Test Script** (después de recibir):
```javascript
// Guardar datos de respuesta para siguiente request
const responseData = pm.response.json();
pm.environment.set("planoId", responseData.planoId);

// Validar contra schema JSON
const schema = {
  type: "object",
  properties: {
    success: { type: "boolean" },
    error: { type: "object" }
  },
  required: ["success"]
};
pm.expect(tv4.validate(responseData, schema)).to.be.true;
```

---

## ✅ Checklist de Validación

Antes de aprobar QA, verificar en Postman:

- [ ] Los 3 escenarios importan correctamente
- [ ] Escenario 1: Todos los tests pasan (4/4)
- [ ] Escenario 2: Todos los tests pasan (4/4)
- [ ] Escenario 3: Todos los tests pasan (4/4)
- [ ] PDFs se descargan sin corrupcción
- [ ] Headers HTTP son correctos
- [ ] Tiempo de respuesta < 5 segundos
- [ ] Collection Runner ejecuta exitosamente
- [ ] Newman CLI funciona (opcional)

---

## 📝 Historial de Cambios

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 2.0.0 | 2026-01-31 | Colección inicial con 3 escenarios + tests automáticos |

---

**Mantenedor**: Sistema QA - Planos Híbridos V2  
**Última actualización**: 2026-01-31
