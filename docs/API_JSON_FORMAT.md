# Formato JSON para API de Generación de Planos

## Endpoint
```
POST /api/v1/planos/generar
```

## Headers Requeridos
```json
{
  "Content-Type": "application/json",
  "X-API-Key": "plpro_tu_api_key_aqui"
}
```

## Formato JSON Completo

```json
{
  "vertices": [
    [284500.00, 8670100.00],
    [284510.00, 8670100.00],
    [284510.00, 8670080.00],
    [284500.00, 8670080.00]
  ],
  "dimensiones": {
    "frente": 10.00,
    "fondo": 10.00,
    "ladoDerecho": 20.00,
    "ladoIzquierdo": 20.00,
    "area": 200.00,
    "perimetro": 60.00
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
    "dni": "12345678",
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
          [284490.00, 8670100.00],
          [284500.00, 8670100.00],
          [284500.00, 8670080.00],
          [284490.00, 8670080.00]
        ],
        "estado": "libre"
      },
      {
        "codigo": "MZ-C-Lote15",
        "vertices": [
          [284510.00, 8670100.00],
          [284520.00, 8670100.00],
          [284520.00, 8670080.00],
          [284510.00, 8670080.00]
        ],
        "estado": "vendido"
      }
    ]
  }
}
```

## Detalles de Cada Campo

### 1. vertices (REQUERIDO)
- **Tipo:** Array de tuplas `[number, number]`
- **Formato:** `[[Este, Norte], ...]` en coordenadas UTM
- **Mínimo:** 3 vértices
- **Ejemplo:** `[[284500, 8670100], [284510, 8670100], [284510, 8670080]]`

### 2. dimensiones (REQUERIDO)
```typescript
{
  frente: number;         // Longitud del frente en metros (positivo)
  fondo: number;          // Longitud del fondo en metros (positivo)
  ladoDerecho: number;    // Longitud del lado derecho en metros (positivo)
  ladoIzquierdo: number;  // Longitud del lado izquierdo en metros (positivo)
  area: number;           // Área total en m² (positivo)
  perimetro: number;      // Perímetro total en metros (positivo)
}
```

### 3. lote (REQUERIDO)
```typescript
{
  codigo: string;         // REQUERIDO - Código único del lote
  nombre: string;         // REQUERIDO - Nombre descriptivo
  manzana: string;        // REQUERIDO - Identificador de manzana
  etapa: string;          // REQUERIDO - Etapa del proyecto
  numeroLote: string;     // REQUERIDO - Número del lote
  estado: "libre" | "separado" | "vendido";  // REQUERIDO
  precio?: number;        // OPCIONAL - Precio en moneda local
  fechaRegistro?: string; // OPCIONAL - Formato: "YYYY-MM-DD"
  ubicacion?: {           // OPCIONAL
    departamento?: string;
    provincia?: string;
    distrito?: string;
    urbanizacion?: string;
    direccion?: string;
  }
}
```

### 4. colindancias (REQUERIDO)
```typescript
Array<{
  lado: "norte" | "sur" | "este" | "oeste" | "frente" | "fondo" | "derecha" | "izquierda";
  tipo: "lote" | "calle" | "area_verde" | "area_comun";
  nombre: string;              // REQUERIDO - Nombre del colindante
  propietario?: string;        // OPCIONAL - Nombre del propietario
  coordinates?: [number, number][]; // OPCIONAL - Coordenadas UTM
}>
```

### 5. propietario (OPCIONAL)
```typescript
{
  nombre: string;         // REQUERIDO si se incluye propietario
  dni?: string;           // OPCIONAL - 8 dígitos
  ruc?: string;           // OPCIONAL - 11 dígitos
  direccion?: string;     // OPCIONAL
  telefono?: string;      // OPCIONAL
  email?: string;         // OPCIONAL - Debe ser email válido
}
```

### 6. config (OPCIONAL)
```typescript
{
  incluirMemoriaDescriptiva?: boolean;  // Default: true
  incluirPlanoPerimetrico?: boolean;    // Default: true
  incluirPlanoUbicacion?: boolean;      // Default: true
  formatoPapel?: "A4" | "A3" | "Legal"; // Default: "A4"
  orientacion?: "portrait" | "landscape"; // Default: "portrait"
  escala?: string;                      // Default: "1/500"
  incluirColindantesEnPlano?: boolean;  // Default: true
}
```

### 7. contexto (OPCIONAL)
```typescript
{
  lotesVecinos?: Array<{
    codigo: string;                    // REQUERIDO
    vertices: [number, number][];      // REQUERIDO - Coordenadas UTM
    estado: string;                    // REQUERIDO
  }>
}
```

## Ejemplo Mínimo Requerido

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

## Respuesta del API

### Éxito (202 Accepted)
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

### Error (400 Bad Request)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Datos inválidos en el request",
    "details": {
      "vertices": {
        "_errors": ["Se requieren al menos 3 vértices"]
      }
    }
  }
}
```

### Error (401 Unauthorized)
```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API key inválida o expirada"
  }
}
```

## Notas Importantes

1. **Coordenadas UTM:** Deben estar en el sistema WGS84, Zona 18S para Perú
2. **Orden de vértices:** Deben estar en sentido horario o antihorario consistente
3. **API Key:** Obtenerla después de registrarse y hacer login
4. **Generación asíncrona:** El PDF se genera en background, revisar Dashboard
5. **Límite de vértices:** Mínimo 3, máximo razonable ~50 para mejor rendimiento
6. **Área y perímetro:** Calculados automáticamente pero deben ser coherentes

## Códigos de Error

| Código | Descripción |
|--------|-------------|
| `MISSING_API_KEY` | No se envió el header X-API-Key |
| `INVALID_API_KEY` | API key incorrecta o expirada |
| `VALIDATION_ERROR` | Datos no cumplen con el schema |
| `INTERNAL_ERROR` | Error del servidor |
