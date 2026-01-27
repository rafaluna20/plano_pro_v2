# Guía de Prueba con Postman

Sigue estos pasos para probar la API `/api/v1/planos/generar` usando Postman.

## 1. Configuración de la Petición

*   **Método:** `POST`
*   **URL:** `http://localhost:3000/api/v1/planos/generar`

## 2. Headers (Encabezados)

Ve a la pestaña **Headers** y agrega:

| Key | Value | Descripción |
| :--- | :--- | :--- |
| `Content-Type` | `application/json` | Indica que envías datos JSON |
| `X-API-Key` | `TU_API_KEY` | Reemplaza `TU_API_KEY` con tu llave real |

> **¿Cómo obtener tu API Key?**
> 1. Inicia sesión en la aplicación web (`http://localhost:3000`).
> 2. Abre la consola del navegador (F12).
> 3. Escribe `localStorage.getItem('apiKey')` y presiona Enter.
> 4. Copia el valor (sin las comillas) y úsalo en Postman.

## 3. Body (Cuerpo)

Ve a la pestaña **Body**, selecciona **raw** y elige **JSON** en el menú desplegable. Pega el siguiente contenido:

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
      }
    ]
  },
  "imagenContexto": {
    "tipo": "captura_pantalla",
    "data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" 
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

## 4. Enviar y Verificar

Haz clic en **Send**. Deberías recibir una respuesta con código **202 Accepted** similar a esta:

```json
{
    "success": true,
    "data": {
        "planoId": "cm...",
        "jobId": "...",
        "status": "pending",
        "metadata": {
            "loteCodigo": "E01MZC014P",
            "fechaGeneracion": "2026-01-27T...",
            "documentosIncluidos": []
        }
    }
}
```

Si recibes un error 400 o 401, verifica el JSON y tu API Key.
