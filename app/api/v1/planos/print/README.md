# PDF Print API Endpoint (`/api/v1/planos/print`)

This endpoint utilizes `@react-pdf/renderer` within Next.js Node.js streaming environment to dynamically generate a formatted, standalone PDF representation of the `PlanoDocument` (Perimetric and Location Sketch PDF).

It accepts the exact JSON structured layout config that is passed manually into the `PDFViewerWrapper` component frontend.

---

### **Endpoint Information**
* **URL:** `/api/v1/planos/print`
* **Method:** `POST`
* **Content-Type:** `application/json`

---

### **Payload Mapping**
The backend accepts a JSON object correlating to the `PlanoDocumentProps` interface layout. 

```json
{
  // REQUIRED OPTIONS
  "modoUbicacion": "vectorial", // "vectorial" | "satelital" | "imagen"
  "vertices": [                 // Array of vertices for the main drafted lot area
    { "id": "A", "x": 280500.00, "y": 8660000.00 },
    { "id": "B", "x": 280540.50, "y": 8660010.20 }
  ],

  // OPTIONAL DESCRIPTIVE METADATA
  "loteId": "L-001",            
  "propietario": "JUAN PEREZ",  
  "ubicacion": "MIRAFLORES",    
  "fecha": "28/03/2026",        
  "escala": "1/100",            
  "lamina": "P-01",             
  
  // VECTORIAL CONTEXTS
  "lotesAdyacentes": [          
    { 
      "id": "LOTE 02", 
      "vertices": [{ "id": "A", "x": 280500.00, "y": 8660000.00 }] 
    }
  ],
  "contexto": {                 
     "vecinos": [
       { "id": "1", "nombre": "CALLE 1", "vertices": [] }
     ]
  },

  // RASTER/IMAGE PROPS (Applied only when modoUbicacion is NOT 'vectorial')
  "satelliteUrl": "https://...", 
  "imagenGeneral": "https://...",
  "logoUrl": "https://..."
}
```

---

### **Expected Responses**

#### **✅ 200 OK (Success)**
* **Headers:** 
  * `Content-Type: application/pdf`
  * `Content-Disposition: inline; filename="plano_perimetrico.pdf"`
* **Body:** The generated binary buffer data stream of the fully built and formatted `.pdf` document.

#### **❌ 500 Internal Server Error**
When an internal syntax parsing, layout resolution, or stream error occurs within `renderToStream()`.
```json
{
  "error": "Failed to generate PDF document"
}
```

---

### **Frontend Integration Example**

To call this endpoint and directly trigger a browser download action or open the PDF in a new window, you process the returning binary `Blob` object:

```javascript
/**
 * Triggers the automatic generation and download of a plano document.
 * @param {Object} planoData - the active PDF view configuration.
 */
async function triggerPdfDownload(planoData) {
  try {
    const response = await fetch('/api/v1/planos/print', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(planoData)
    });

    if (!response.ok) {
      throw new Error('Failed to generate PDF on the server');
    }

    // Capture the payload stream into a browser Blob
    const blob = await response.blob();
    
    // Create a local object URL mapping to the raw PDF
    const pdfUrl = window.URL.createObjectURL(blob);

    // ACTION: Automatically trigger a download
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = `${planoData.loteId || 'plano_perimetrico'}.pdf`; 
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up memory after browser captures it natively
    setTimeout(() => window.URL.revokeObjectURL(pdfUrl), 100);
    
  } catch (error) {
    console.error("Error while fetching printable PDF:", error);
  }
}
```
