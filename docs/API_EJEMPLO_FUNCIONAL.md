# API `/api/v1/planos/generar` - Ejemplo Funcional Completo

## Análisis Técnico

### Endpoint
```
POST http://localhost:3000/api/v1/planos/generar
```

### Headers Obligatorios
```json
{
  "Content-Type": "application/json",
  "X-API-Key": "plpro_xxxxxxxxxxxxxxxxxxxxx"
}
```

> **Nota:** La API key se obtiene después de registrarse y hacer login. Se almacena en `localStorage.getItem('apiKey')`.

---

## Schema de Validación (Zod)

La API valida el JSON usando estos schemas:

### Campos OBLIGATORIOS

```typescript
{
  vertices: Array<[number, number]>  // Mínimo 3 vértices, formato: [[Este, Norte], ...]
  dimensiones: {
    frente: number (positivo)
    fondo: number (positivo)
    ladoDerecho: number (positivo)
    ladoIzquierdo: number (positivo)
    area: number (positivo)
    perimetro: number (positivo)
  }
  lote: {
    codigo: string
    nombre: string
    manzana: string
    etapa: string
    numeroLote: string
    estado: "libre" | "separado" | "vendido"
  }
  colindancias: Array<{
    lado: "norte" | "sur" | "este" | "oeste" | "frente" | "fondo" | "derecha" | "izquierda"
    tipo: "lote" | "calle" | "area_verde" | "area_comun"
    nombre: string
  }>
}
```

### Campos OPCIONALES

```typescript
{
  propietario?: {
    nombre: string
    dni?: string
    ruc?: string
    direccion?: string
    telefono?: string
    email?: string (debe ser email válido)
  }
  config?: {
    incluirMemoriaDescriptiva?: boolean
    incluirPlanoPerimetrico?: boolean
    incluirPlanoUbicacion?: boolean
    formatoPapel?: "A4" | "A3" | "Legal"
    orientacion?: "portrait" | "landscape"
    escala?: string
    incluirColindantesEnPlano?: boolean
  }
  contexto?: {
    lotesVecinos?: Array<{
      codigo: string
      vertices: Array<[number, number]>
      estado: string
    }>
  }
}
```

---

## ✅ EJEMPLO 1: JSON MÍNIMO (Solo campos obligatorios)

```json
{
  "vertices": [
    [284500, 8670100],
    [284510, 8670100],
    [284510, 8670080],
    [284500, 8670080]
  ],
  "dimensiones": {
    "frente": 10,
    "fondo": 10,
    "ladoDerecho": 20,
    "ladoIzquierdo": 20,
    "area": 200,
    "perimetro": 60
  },
  "lote": {
    "codigo": "MZ-A-L01",
    "nombre": "Lote 1",
    "manzana": "A",
    "etapa": "1",
    "numeroLote": "01",
    "estado": "libre"
  },
  "colindancias": [
    {
      "lado": "frente",
      "tipo": "calle",
      "nombre": "Calle Principal"
    },
    {
      "lado": "fondo",
      "tipo": "lote",
      "nombre": "Lote 2"
    },
    {
      "lado": "izquierda",
      "tipo": "lote",
      "nombre": "Lote 10"
    },
    {
      "lado": "derecha",
      "tipo": "lote",
      "nombre": "Lote 11"
    }
  ]
}
```

---

## ✅ EJEMPLO 2: JSON COMPLETO (Todos los campos)

```json
{
  "vertices": [
    [284500, 8670100],
    [284510, 8670100],
    [284510, 8670080],
    [284500, 8670080]
  ],
  "dimensiones": {
    "frente": 10,
    "fondo": 10,
    "ladoDerecho": 20,
    "ladoIzquierdo": 20,
    "area": 200,
    "perimetro": 60
  },
  "lote": {
    "codigo": "MZ-C-Lote14",
    "nombre": "Lote 14 Manzana C",
    "manzana": "MZ-C",
    "etapa": "Etapa 1",
    "numeroLote": "14",
    "estado": "libre",
    "precio": 150000,
    "fechaRegistro": "2024-01-15",
    "ubicacion": {
      "departamento": "Lima",
      "provincia": "Lima",
      "distrito": "San Juan de Lurigancho",
      "urbanizacion": "Los Cedros",
      "direccion": "Mz. C Lote 14"
    }
  },
  "colindancias": [
    {
      "lado": "frente",
      "tipo": "calle",
      "nombre": "Av. Los Alamos",
      "propietario": "Municipalidad"
    },
    {
      "lado": "fondo",
      "tipo": "lote",
      "nombre": "Lote 05",
      "propietario": "Juan Pérez García"
    },
    {
      "lado": "izquierda",
      "tipo": "lote",
      "nombre": "Lote 13",
      "propietario": "María González"
    },
    {
      "lado": "derecha",
      "tipo": "lote",
      "nombre": "Lote 15",
      "propietario": "Pedro Sánchez"
    }
  ],
  "propietario": {
    "nombre": "Inversiones Santa Rosa S.A.C.",
    "ruc": "20123456789",
    "direccion": "Av. Principal 123, Lima",
    "telefono": "+51 987654321",
    "email": "contacto@santarosa.com"
  },
  "config": {
    "incluirMemoriaDescriptiva": true,
    "incluirPlanoPerimetrico": true,
    "incluirPlanoUbicacion": true,
    "formatoPapel": "A4",
    "orientacion": "portrait",
    "escala": "1/500",
    "incluirColindantesEnPlano": true
  },
  "contexto": {
    "lotesVecinos": [
      {
        "codigo": "MZ-C-Lote13",
        "vertices": [
          [284490, 8670100],
          [284500, 8670100],
          [284500, 8670080],
          [284490, 8670080]
        ],
        "estado": "libre"
      },
      {
        "codigo": "MZ-C-Lote15",
        "vertices": [
          [284510, 8670100],
          [284520, 8670100],
          [284520, 8670080],
          [284510, 8670080]
        ],
        "estado": "vendido"
      }
    ]
  }
}
```

---

## ✅ EJEMPLO 3: JSON Desde `app/page.tsx`

Este es el formato que usa actualmente la función `handleGeneratePDF` en la página principal:

```javascript
const requestData = {
  vertices: data.vertices.map(v => [v.x, v.y]),
  dimensiones: {
    frente: data.dimensiones.frente || 0,
    fondo: data.dimensiones.fondo || 0,
    ladoDerecho: data.dimensiones.derecha || 0,
    ladoIzquierdo: data.dimensiones.izquierda || 0,
    area: data.dimensiones.area || 0,
    perimetro: calculatedPerimeter
  },
  lote: {
    codigo: data.loteId,
    nombre: data.loteId,
    manzana: data.loteId.split('-')[0] || 'MZ-A',
    etapa: 'Etapa 1',
    numeroLote: data.loteId.split('-')[2] || '01',
    estado: 'libre'
  },
  colindancias: [
    { lado: 'frente', tipo: 'calle', nombre: data.colindantes.frente || 'No especificado' },
    { lado: 'fondo', tipo: 'lote', nombre: data.colindantes.fondo || 'No especificado' },
    { lado: 'izquierda', tipo: 'lote', nombre: data.colindantes.izquierda || 'No especificado' },
    { lado: 'derecha', tipo: 'lote', nombre: data.colindantes.derecha || 'No especificado' }
  ],
  propietario: {
    nombre: data.propietario || 'Sin propietario'
  },
  config: {
    incluirMemoriaDescriptiva: true,
    incluirPlanoPerimetrico: true,
    incluirPlanoUbicacion: true,
    formatoPapel: 'A4',
    orientacion: 'portrait',
    escala: data.membrete.escala,
    incluirColindantesEnPlano: true
  },
  contexto: data.contexto.vecinos && data.contexto.vecinos.length > 0 ? {
    lotesVecinos: data.contexto.vecinos.map(v => ({
      codigo: v.codigo || v.nombre,
      vertices: v.vertices.map(vt => [vt.x, vt.y]),
      estado: v.estado || 'libre'
    }))
  } : undefined
};
```

---

## Respuestas del API

### ✅ Éxito (202 Accepted)
```json
{
  "success": true,
  "data": {
    "planoId": "clxxx123456789",
    "jobId": "job_xxx123456789",
    "status": "pending",
    "metadata": {
      "loteCodigo": "MZ-C-Lote14",
      "fechaGeneracion": "2024-01-15T10:30:00.000Z",
      "documentosIncluidos": []
    }
  }
}
```

### ❌ Error 400 - Validación
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos en el request",
    "details": {
      "vertices": {
        "_errors": ["Se requieren al menos 3 vértices"]
      },
      "dimensiones": {
        "area": {
          "_errors": ["Expected number, received nan"]
        }
      }
    }
  }
}
```

### ❌ Error 401 - Autenticación
```json
{
  "success": false,
  "error": {
    "code": "MISSING_API_KEY",
    "message": "API key requerida en header X-API-Key"
  }
}
```

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API key inválida o expirada"
  }
}
```

---

## Ejemplo de Llamada con cURL

```bash
curl -X POST http://localhost:3000/api/v1/planos/generar \
  -H "Content-Type: application/json" \
  -H "X-API-Key: plpro_tu_api_key_aqui" \
  -d '{
    "vertices": [[284500, 8670100], [284510, 8670100], [284510, 8670080], [284500, 8670080]],
    "dimensiones": {
      "frente": 10,
      "fondo": 10,
      "ladoDerecho": 20,
      "ladoIzquierdo": 20,
      "area": 200,
      "perimetro": 60
    },
    "lote": {
      "codigo": "MZ-A-L01",
      "nombre": "Lote 1",
      "manzana": "A",
      "etapa": "1",
      "numeroLote": "01",
      "estado": "libre"
    },
    "colindancias": [
      {"lado": "frente", "tipo": "calle", "nombre": "Calle Principal"},
      {"lado": "fondo", "tipo": "lote", "nombre": "Lote 2"},
      {"lado": "izquierda", "tipo": "lote", "nombre": "Lote 10"},
      {"lado": "derecha", "tipo": "lote", "nombre": "Lote 11"}
    ]
  }'
```

---

## Ejemplo de Llamada con JavaScript/Fetch

```javascript
const response = await fetch('http://localhost:3000/api/v1/planos/generar', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': localStorage.getItem('apiKey') // Obtener del usuario autenticado
  },
  body: JSON.stringify({
    vertices: [
      [284500, 8670100],
      [284510, 8670100],
      [284510, 8670080],
      [284500, 8670080]
    ],
    dimensiones: {
      frente: 10,
      fondo: 10,
      ladoDerecho: 20,
      ladoIzquierdo: 20,
      area: 200,
      perimetro: 60
    },
    lote: {
      codigo: "MZ-A-L01",
      nombre: "Lote 1",
      manzana: "A",
      etapa: "1",
      numeroLote: "01",
      estado: "libre"
    },
    colindancias: [
      { lado: "frente", tipo: "calle", nombre: "Calle Principal" },
      { lado: "fondo", tipo: "lote", nombre: "Lote 2" },
      { lado: "izquierda", tipo: "lote", nombre: "Lote 10" },
      { lado: "derecha", tipo: "lote", nombre: "Lote 11" }
    ]
  })
});

const result = await response.json();

if (result.success) {
  console.log('PDF en generación:', result.data);
  // Redirigir al dashboard para ver el progreso
} else {
  console.error('Error:', result.error.message);
}
```

---

## Errores Comunes y Soluciones

### 1. Error: "Se requieren al menos 3 vértices"
```json
"vertices": [[284500, 8670100]] // ❌ Solo 1 vértice
```
**Solución:** Enviar mínimo 3 vértices
```json
"vertices": [[284500, 8670100], [284510, 8670100], [284510, 8670080]]
```

### 2. Error: "Expected number, received string"
```json
"dimensiones": {
  "area": "200" // ❌ String
}
```
**Solución:** Usar números sin comillas
```json
"dimensiones": {
  "area": 200 // ✅ Number
}
```

### 3. Error: "Invalid enum value"
```json
"lote": {
  "estado": "ocupado" // ❌ Valor no permitido
}
```
**Solución:** Usar solo valores permitidos
```json
"lote": {
  "estado": "libre" // ✅ "libre" | "separado" | "vendido"
}
```

### 4. Error: Coordenadas en formato incorrecto
```json
"vertices": [
  {"x": 284500, "y": 8670100} // ❌ Objetos
]
```
**Solución:** Usar tuplas [x, y]
```json
"vertices": [
  [284500, 8670100] // ✅ Tuplas
]
```

---

## Notas Importantes

1. **Coordenadas UTM:** Sistema WGS84, Zona 18S (Perú)
2. **Generación Asíncrona:** El PDF no se genera inmediatamente, se encola
3. **API Key:** Se obtiene automáticamente al hacer login
4. **Orden de Vértices:** Pueden estar en sentido horario o antihorario
5. **Límites:** El sistema soporta hasta ~50 vértices por polígono
6. **Timeout:** El endpoint tiene un timeout de 30 segundos

---

## Flujo Completo

1. Usuario se registra/logea → Obtiene API key
2. Usuario envía POST con JSON al endpoint
3. API valida JSON con Zod schemas
4. Se crea registro en base de datos (Prisma)
5. Se encola job de generación (BullMQ)
6. Se retorna 202 con jobId
7. Worker procesa el job en background
8. PDF se genera y sube a storage
9. Usuario ve el resultado en Dashboard
