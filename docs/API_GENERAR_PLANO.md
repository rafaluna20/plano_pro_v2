# API: Generar Plano - Análisis Técnico Detallado

Análisis experto del payload JSON que envía el botón "Generar Plano" al endpoint `/api/v1/planos/generar`.

## 📍 Ubicación del Código

**Archivo:** [`app/editor/[planoId]/page.tsx`](../app/editor/[planoId]/page.tsx)  
**Función:** `handleGeneratePlano` (líneas 145-207)  
**Endpoint:** `POST /api/v1/planos/generar`

## 🔍 Request HTTP Completo

### **Headers**
```http
POST /api/v1/planos/generar HTTP/1.1
Host: localhost:3000
Content-Type: application/json
x-api-key: sk_live_clxxxxxxxxxxxxxx
```

**Explicación de Headers:**
- `Content-Type: application/json` - Indica que el body es JSON
- `x-api-key` - API key del usuario obtenida de `localStorage.getItem('apiKey')`
  - Se genera automáticamente al registrarse
  - Formato: `sk_live_` + cuid
  - Ejemplo: `sk_live_clxyabc123def456ghi789`

### **Body (JSON Payload)**

```json
{
  "vertices": [
    [276500, 8664500],
    [276520, 8664500],
    [276520, 8664480],
    [276500, 8664480]
  ],
  "dimensiones": {
    "area": 400.0,
    "perimetro": 80.0,
    "frente": 20.0,
    "ladoDerecho": 20.0,
    "fondo": 20.0,
    "ladoIzquierdo": 20.0
  },
  "lote": {
    "codigo": "E02MZT011",
    "nombre": "Etapa 02 Mz T Lote 11",
    "manzana": "T",
    "etapa": "Etapa 02",
    "numeroLote": "11",
    "estado": "libre"
  },
  "colindancias": [
    {
      "lado": "norte",
      "tipo": "lote",
      "nombre": "Lote 12",
      "propietario": "Juan Pérez"
    },
    {
      "lado": "sur",
      "tipo": "calle",
      "nombre": "Av. Principal"
    },
    {
      "lado": "este",
      "tipo": "area_verde",
      "nombre": "Parque Central"
    },
    {
      "lado": "oeste",
      "tipo": "lote",
      "nombre": "Lote 10"
    }
  ],
  "config": {
    "incluirMemoriaDescriptiva": true,
    "incluirPlanoPerimetrico": true,
    "incluirPlanoUbicacion": true,
    "formatoPapel": "A4",
    "orientacion": "portrait"
  }
}
```

## 📊 Análisis Detallado de Cada Campo

### **1. vertices** (Array de Coordenadas UTM)

```typescript
vertices: UTMCoordinate[]  // UTMCoordinate = [number, number]
```

**Tipo:** `Array<[Este, Norte]>`  
**Sistema:** WGS84 / Zona 18S (Perú)  
**Unidades:** Metros

**Ejemplo Real:**
```json
[
  [276500, 8664500],  // Vértice 1: Este=276500m, Norte=8664500m
  [276520, 8664500],  // Vértice 2: Este=276520m, Norte=8664500m (20m al este)
  [276520, 8664480],  // Vértice 3: Este=276520m, Norte=8664480m (20m al sur)
  [276500, 8664480]   // Vértice 4: Este=276500m, Norte=8664480m (20m al oeste)
]
```

**Representa:** Un lote rectangular de 20m × 20m = 400m²

**Origen de Datos:**
- Proviene del estado `vertices` (línea 18)
- Se puede editar en el mapa interactivo ([`MapCanvas`](../components/editor/MapCanvas.tsx))
- Valores iniciales en líneas 88-94

**Validación en Backend:**
```typescript
// En lib/validators/schemas.ts
z.array(z.tuple([z.number(), z.number()])).min(3)
```
- Mínimo 3 vértices (triángulo)
- Cada vértice es un array de 2 números [Este, Norte]

---

### **2. dimensiones** (Medidas Calculadas Automáticamente)

```typescript
dimensiones: Dimensiones
```

**Tipo:**
```typescript
interface Dimensiones {
  frente: number;        // Metros
  fondo: number;         // Metros
  ladoDerecho: number;   // Metros
  ladoIzquierdo: number; // Metros
  area: number;          // Metros cuadrados
  perimetro: number;     // Metros lineales
}
```

**Ejemplo Real:**
```json
{
  "area": 400.0,
  "perimetro": 80.0,
  "frente": 20.0,
  "ladoDerecho": 20.0,
  "fondo": 20.0,
  "ladoIzquierdo": 20.0
}
```

**Origen de Datos:**
- **Cálculo automático** desde `vertices` (líneas 63-82)
- Usa funciones de geometría UTM:
  - [`calculateArea()`](../lib/geometry/utmUtils.ts) - Fórmula del área de polígono
  - [`calculatePerimeter()`](../lib/geometry/utmUtils.ts) - Suma de distancias
  - [`calculateDistance()`](../lib/geometry/utmUtils.ts) - Teorema de Pitágoras

**Cálculos Específicos:**
```typescript
// Área (usando fórmula Shoelace)
area = calculateArea(vertices); // 400.0 m²

// Perímetro (suma de distancias entre vértices consecutivos)
perimetro = calculatePerimeter(vertices); // 80.0 m

// Lados individuales
frente = distance(v0, v1);         // 20.0 m (lado norte)
ladoDerecho = distance(v1, v2);    // 20.0 m (lado este)
fondo = distance(v2, v3);          // 20.0 m (lado sur)
ladoIzquierdo = distance(v3, v0);  // 20.0 m (lado oeste)
```

**Importancia:** Estas medidas aparecen en la Memoria Descriptiva y en el Plano Perimétrico.

---

### **3. lote** (Metadata del Lote)

```typescript
lote: LoteMetadata
```

**Tipo:**
```typescript
interface LoteMetadata {
  codigo: string;      // Código único del lote
  nombre: string;      // Descripción del lote
  manzana: string;     // Manzana catastral
  etapa: string;       // Etapa de habilitación
  numeroLote: string;  // Número de lote
  estado: 'libre' | 'ocupado' | 'vendido';
}
```

**Ejemplo Real:**
```json
{
  "codigo": "E02MZT011",
  "nombre": "Etapa 02 Mz T Lote 11",
  "manzana": "T",
  "etapa": "Etapa 02",
  "numeroLote": "11",
  "estado": "libre"
}
```

**Origen de Datos:**
- Estado inicial en líneas 19-26
- Editable en [`PropertyPanel`](../components/editor/PropertyPanel.tsx)

**Uso en PDF:**
- **Título del plano:** "Etapa 02 Mz T Lote 11"
- **Código de referencia:** "E02MZT011"
- **Identificación catastral:** "Manzana T, Lote 11"

**Nomenclatura:**
- `E02` = Etapa 02
- `MZ` = Manzana
- `T` = Letra de manzana
- `011` = Número de lote (con padding)

---

### **4. colindancias** (Límites del Lote)

```typescript
colindancias: Colindancia[]
```

**Tipo:**
```typescript
interface Colindancia {
  lado: 'norte' | 'sur' | 'este' | 'oeste';
  tipo: 'lote' | 'calle' | 'area_verde' | 'pasaje' | 'acequia';
  nombre: string;
  propietario?: string;
}
```

**Ejemplo Real:**
```json
[
  {
    "lado": "norte",
    "tipo": "lote",
    "nombre": "Lote 12",
    "propietario": "Juan Pérez"
  },
  {
    "lado": "sur",
    "tipo": "calle",
    "nombre": "Av. Principal"
  },
  {
    "lado": "este",
    "tipo": "area_verde",
    "nombre": "Parque Central"
  },
  {
    "lado": "oeste",
    "tipo": "lote",
    "nombre": "Lote 10"
  }
]
```

**Origen de Datos:**
- Estado inicial en líneas 35-57
- Editable en [`PropertyPanel`](../components/editor/PropertyPanel.tsx)

**Uso en PDF:**

**Memoria Descriptiva:**
```
LINDEROS Y COLINDANCIAS:
- Por el Norte: con Lote 12 propiedad de Juan Pérez, con 20.00 ml
- Por el Sur: con Av. Principal, con 20.00 ml
- Por el Este: con Parque Central, con 20.00 ml
- Por el Oeste: con Lote 10, con 20.00 ml
```

**Plano Perimétrico:**
- Etiquetas en cada lado del polígono
- Flechas indicando dirección
- Texto con nombre del colindante

**Tipos de Colindancias:**
- `lote` - Otro lote (requiere propietario)
- `calle` - Vía pública
- `area_verde` - Parque o zona verde
- `pasaje` - Vía peatonal
- `acequia` - Canal de riego

---

### **5. config** (Configuración del PDF)

```typescript
config: PlanoConfig
```

**Tipo:**
```typescript
interface PlanoConfig {
  incluirMemoriaDescriptiva: boolean;
  incluirPlanoPerimetrico: boolean;
  incluirPlanoUbicacion: boolean;
  formatoPapel: 'A4' | 'A3' | 'Legal';
  orientacion: 'portrait' | 'landscape';
  escala?: string;
  incluirColindantesEnPlano?: boolean;
}
```

**Ejemplo Real (Hardcoded en el código):**
```json
{
  "incluirMemoriaDescriptiva": true,
  "incluirPlanoPerimetrico": true,
  "incluirPlanoUbicacion": true,
  "formatoPapel": "A4",
  "orientacion": "portrait"
}
```

**Significado:**

| Campo | Valor | Descripción |
|-------|-------|-------------|
| `incluirMemoriaDescriptiva` | `true` | ✅ Genera documento de Memoria Descriptiva (página 1) |
| `incluirPlanoPerimetrico` | `true` | ✅ Genera plano técnico CAD (página 2) |
| `incluirPlanoUbicacion` | `true` | ✅ Genera mapa de ubicación (página 3) |
| `formatoPapel` | `"A4"` | Papel: 210mm × 297mm |
| `orientacion` | `"portrait"` | Vertical (no horizontal) |

**Resultado:** PDF de 3 páginas en formato A4 vertical

---

## 🔄 Flujo Completo de la Petición

### **Fase 1: Envío Inicial (Líneas 150-169)**

```typescript
const response = await fetch('/api/v1/planos/generar', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'sk_live_clxxxxxxxxxxxxxx' // ← Desde localStorage
  },
  body: JSON.stringify({
    vertices: [[276500, 8664500], ...],
    dimensiones: { area: 400, ... },
    lote: { codigo: 'E02MZT011', ... },
    colindancias: [{ lado: 'norte', ... }, ...],
    config: { incluirMemoriaDescriptiva: true, ... }
  })
});
```

### **Fase 2: Respuesta del Backend (Línea 171)**

```json
{
  "success": true,
  "data": {
    "planoId": "clxy123abc456def789",
    "message": "Plano encolado para generación",
    "status": "PENDING"
  }
}
```

El backend retorna inmediatamente con el ID del plano, **sin esperar** a que se genere el PDF.

### **Fase 3: Polling de Status (Líneas 175-196)**

El frontend hace polling cada 2 segundos para verificar el estado:

```typescript
const checkStatus = async () => {
  const statusResponse = await fetch(`/api/v1/planos/${planoId}`, {
    headers: {
      'x-api-key': localStorage.getItem('apiKey') || ''
    }
  });

  const statusData = await statusResponse.json();
  
  if (statusData.data.status === 'COMPLETED') {
    // PDF listo, mostrar en preview
    setPdfUrl(statusData.data.pdfUrl);
    setGenerationStatus('completed');
  } else if (statusData.data.status === 'FAILED') {
    // Error en generación
    setError(statusData.data.errorMessage);
    setGenerationStatus('error');
  } else {
    // Sigue procesando, volver a intentar en 2 segundos
    setTimeout(checkStatus, 2000);
  }
};

setTimeout(checkStatus, 2000);
```

**Respuestas posibles:**

**Estado PENDING:**
```json
{
  "success": true,
  "data": {
    "id": "clxy123abc456def789",
    "status": "PENDING",
    "loteCodigo": "E02MZT011",
    "pdfUrl": null
  }
}
```

**Estado PROCESSING:**
```json
{
  "success": true,
  "data": {
    "id": "clxy123abc456def789",
    "status": "PROCESSING",
    "loteCodigo": "E02MZT011",
    "pdfUrl": null
  }
}
```

**Estado COMPLETED:**
```json
{
  "success": true,
  "data": {
    "id": "clxy123abc456def789",
    "status": "COMPLETED",
    "loteCodigo": "E02MZT011",
    "pdfUrl": "/uploads/2026/01/24/plano_E02MZT011_1706134567890.pdf",
    "pdfSize": 256789,
    "generatedAt": "2026-01-24T21:15:45.123Z"
  }
}
```

**Estado FAILED:**
```json
{
  "success": true,
  "data": {
    "id": "clxy123abc456def789",
    "status": "FAILED",
    "loteCodigo": "E02MZT011",
    "errorMessage": "Error al calcular área del polígono"
  }
}
```

## 🔬 Procesamiento en Backend

### **Endpoint:** `/api/v1/planos/generar` ([`app/api/v1/planos/generar/route.ts`](../app/api/v1/planos/generar/route.ts))

**Paso 1: Validación con Zod**
```typescript
const validationResult = generarPlanosSchema.safeParse(body);

// Valida:
// - vertices: mínimo 3, array de [number, number]
// - dimensiones: todos los campos numéricos positivos
// - lote.codigo: string no vacío
// - colindancias: array con 'lado', 'tipo', 'nombre'
// - config: booleanos y strings válidos
```

**Paso 2: Obtener Usuario desde API Key**
```typescript
const apiKey = await validateApiKey(request.headers.get('x-api-key'));
const userId = apiKey.userId;
```

**Paso 3: Crear Registro en PostgreSQL**
```typescript
const plano = await db.plano.create({
  data: {
    loteCodigo: lote.codigo,
    loteNombre: lote.nombre,
    manzana: lote.manzana,
    etapa: lote.etapa,
    numeroLote: lote.numeroLote,
    vertices: vertices,         // JSON
    dimensiones: dimensiones,   // JSON
    colindancias: colindancias, // JSON
    propietario: null,
    config: config,             // JSON
    status: 'PENDING',
    userId: userId,
    source: 'editor'
  }
});
```

**Paso 4: Encolar Job en Redis (BullMQ)**
```typescript
await planosQueue.add('generate-plano', {
  planoId: plano.id,
  vertices,
  dimensiones,
  lote,
  colindancias,
  config,
  userId
}, {
  priority: 1,
  jobId: `plano-${plano.id}`
});
```

**Paso 5: Retornar Respuesta Inmediata**
```typescript
return {
  success: true,
  data: {
    planoId: plano.id,
    message: "Plano encolado para generación",
    status: "PENDING"
  }
};
```

## ⚙️ Procesamiento en Worker

### **Worker:** [`workers/plano-generator.ts`](../workers/plano-generator.ts)

**Job Data Recibido:**
```typescript
{
  planoId: "clxy123abc456def789",
  vertices: [[276500, 8664500], ...],
  dimensiones: { area: 400, ... },
  lote: { codigo: 'E02MZT011', ... },
  colindancias: [{ lado: 'norte', ... }, ...],
  config: { incluirMemoriaDescriptiva: true, ... },
  userId: "clxu999xxx111yyy222"
}
```

**Paso 1: Update Status → PROCESSING**
```typescript
await db.plano.update({
  where: { id: planoId },
  data: { status: 'PROCESSING', jobId: job.id }
});
```

**Paso 2: Generar PDF**
```typescript
const generator = new PlanoGenerator({
  vertices,
  dimensiones,
  lote,
  colindancias,
  config
});

const pdfBuffer = await generator.generate();
```

Esto genera 3 documentos:
1. **Memoria Descriptiva** ([`MemoriaDescriptiva.ts`](../lib/generators/MemoriaDescriptiva.ts))
2. **Plano Perimétrico** ([`PlanoPerimetrico.ts`](../lib/generators/PlanoPerimetrico.ts))
3. **Plano de Ubicación** ([`PlanoUbicacion.ts`](../lib/generators/PlanoUbicacion.ts))

**Paso 3: Guardar en Almacenamiento**
```typescript
const filename = `plano_E02MZT011_1706134567890.pdf`;
const pdfUrl = await storage.save(pdfBuffer, filename);
// Retorna: "/uploads/2026/01/24/plano_E02MZT011_1706134567890.pdf"
// O si es GCS: "https://storage.googleapis.com/bucket/planos/2026/01/24/..."
```

**Paso 4: Update Status → COMPLETED**
```typescript
await db.plano.update({
  where: { id: planoId },
  data: {
    status: 'COMPLETED',
    pdfUrl: pdfUrl,
    pdfSize: pdfBuffer.length,
    generatedAt: new Date()
  }
});
```

## 📈 Timeline Típica

```
t=0s    Usuario hace clic en "Generar Plano"
t=0.1s  POST /api/v1/planos/generar → Respuesta inmediata con planoId
t=0.1s  Frontend comienza polling cada 2s
t=2s    GET /api/v1/planos/[id] → status: PENDING
t=2.5s  Worker detecta job y comienza procesamiento
t=2.6s  PostgreSQL actualizado a PROCESSING
t=4s    GET /api/v1/planos/[id] → status: PROCESSING
t=5s    PDF generado (Memoria + Plano + Ubicación)
t=5.5s  PDF guardado en almacenamiento
t=5.6s  PostgreSQL actualizado a COMPLETED con pdfUrl
t=6s    GET /api/v1/planos/[id] → status: COMPLETED ✅
t=6.1s  Frontend muestra PDF en preview
```

**Tiempo total:** ~6 segundos (depende de la complejidad del plano)

## 🛡️ Validaciones Aplicadas

### **En Frontend (Antes de Enviar)**
```typescript
// Botón deshabilitado si:
disabled={vertices.length < 3 || generationStatus === 'generating'}
```

### **En Backend (Zod Schema)**
```typescript
// vertices
z.array(z.tuple([z.number(), z.number()])).min(3)
// Mínimo 3 vértices, cada uno [Este, Norte]

// dimensiones.area
z.number().positive()
// Debe ser número positivo

// lote.codigo
z.string().min(1)
// No puede estar vacío

// colindancias
z.array(z.object({
  lado: z.enum(['norte', 'sur', 'este', 'oeste']),
  tipo: z.enum(['lote', 'calle', 'area_verde', 'pasaje', 'acequia']),
  nombre: z.string()
}))
```

## 💾 Datos Almacenados en PostgreSQL

Después de la generación exitosa, el registro en la tabla `planos`:

```sql
SELECT * FROM planos WHERE id = 'clxy123abc456def789';
```

```
id: clxy123abc456def789
loteCodigo: E02MZT011
loteNombre: Etapa 02 Mz T Lote 11
manzana: T
etapa: Etapa 02
numeroLote: 11
vertices: [[276500,8664500],[276520,8664500],[276520,8664480],[276500,8664480]]
dimensiones: {"area":400,"perimetro":80,"frente":20,"ladoDerecho":20,"fondo":20,"ladoIzquierdo":20}
colindancias: [{"lado":"norte","tipo":"lote","nombre":"Lote 12","propietario":"Juan Pérez"},...] 
propietario: null
pdfUrl: /uploads/2026/01/24/plano_E02MZT011_1706134567890.pdf
pdfSize: 256789
status: COMPLETED
jobId: generate-plano-clxy123abc456def789
errorMessage: null
config: {"incluirMemoriaDescriptiva":true,"incluirPlanoPerimetrico":true,"incluirPlanoUbicacion":true,"formatoPapel":"A4","orientacion":"portrait"}
userId: clxu999xxx111yyy222
source: editor
generatedAt: 2026-01-24 21:15:45.123
createdAt: 2026-01-24 21:15:39.456
updatedAt: 2026-01-24 21:15:45.789
```

## 🎯 Resumen Ejecutivo

El botón "Generar Plano" envía un payload JSON completo y estructurado que contiene:

1. **Geometría del lote** (vertices en UTM)
2. **Medidas calculadas** (area, perímetro, lados)
3. **Identificación catastral** (código, manzana, etapa, número)
4. **Límites y colindantes** (norte, sur, este, oeste con tipos)
5. **Configuración del documento** (qué incluir, formato, orientación)

Este payload se procesa de forma **asíncrona** usando Redis/BullMQ para no bloquear la interfaz, permitiendo que el usuario siga trabajando mientras el PDF se genera en background por el worker.
