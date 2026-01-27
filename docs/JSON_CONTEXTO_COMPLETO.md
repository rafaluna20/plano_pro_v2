# Ejemplo JSON Completo con Contexto Urbano (5 Lotes Vecinos)

Este ejemplo muestra cómo enviar un lote central rodeado por 5 lotes vecinos para generar un plano de ubicación rico en contexto.

```json
{
  "lote": {
    "codigo": "E01MZC014P",
    "nombre": "Lote 14 - Manzana C - Etapa 1",
    "manzana": "C",
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
      "direccion": "Av. Los Alamos S/N"
    }
  },
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
  "colindancias": [
    {
      "lado": "FRENTE",
      "tipo": "calle",
      "nombre": "Av. Los Alamos",
      "longitud": 10.00
    },
    {
      "lado": "FONDO",
      "tipo": "lote",
      "nombre": "Lote 05",
      "propietario": "Juan Pérez García",
      "longitud": 10.00
    },
    {
      "lado": "IZQUIERDA",
      "tipo": "lote",
      "nombre": "Lote 13",
      "propietario": "María González",
      "longitud": 20.00
    },
    {
      "lado": "DERECHA",
      "tipo": "lote",
      "nombre": "Lote 15",
      "propietario": "Pedro Sánchez",
      "longitud": 20.00
    }
  ],
  "contexto": {
    "radioBusqueda": 50,
    "elementos": [
      {
        "tipo": "LOTE",
        "codigo": "E01MZC013P",
        "texto": "13",
        "estado": "libre",
        "vertices": [
          [284490.00, 8670100.00],
          [284500.00, 8670100.00],
          [284500.00, 8670080.00],
          [284490.00, 8670080.00]
        ]
      },
      {
        "tipo": "LOTE",
        "codigo": "E01MZC015P",
        "texto": "15",
        "estado": "vendido",
        "vertices": [
          [284510.00, 8670100.00],
          [284520.00, 8670100.00],
          [284520.00, 8670080.00],
          [284510.00, 8670080.00]
        ]
      },
      {
        "tipo": "LOTE",
        "codigo": "E01MZC005P",
        "texto": "05",
        "estado": "vendido",
        "vertices": [
          [284500.00, 8670080.00],
          [284510.00, 8670080.00],
          [284510.00, 8670060.00],
          [284500.00, 8670060.00]
        ]
      },
      {
        "tipo": "LOTE",
        "codigo": "E01MZC004P",
        "texto": "04",
        "estado": "libre",
        "vertices": [
          [284490.00, 8670080.00],
          [284500.00, 8670080.00],
          [284500.00, 8670060.00],
          [284490.00, 8670060.00]
        ]
      },
      {
        "tipo": "LOTE",
        "codigo": "E01MZC006P",
        "texto": "06",
        "estado": "separado",
        "vertices": [
          [284510.00, 8670080.00],
          [284520.00, 8670080.00],
          [284520.00, 8670060.00],
          [284510.00, 8670060.00]
        ]
      }
    ]
  },
  "propietario": {
    "nombre": "Inversiones Santa Rosa S.A.C.",
    "dni": null,
    "ruc": "20123456789",
    "direccion": "Av. Principal 123, Lima",
    "telefono": "+51 987654321",
    "email": "contacto@santarosa.com"
  },
  "config": {
    "incluirMemoriaDescriptiva": true,
    "incluirPlanoPerimetrico": true,
    "incluirPlanoUbicacion": true,
    "formatoPapel": "A3",
    "orientacion": "landscape",
    "escala": "1/500",
    "incluirColindantesEnPlano": true
  }
}
```
