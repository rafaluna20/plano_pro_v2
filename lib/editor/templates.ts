import { PlanoTemplate } from '@/types/editor';
import { UTMCoordinate } from '@/types/planos';

/**
 * Plantillas predefinidas de lotes para diferentes escenarios
 * Coordenadas en formato UTM Zone 18S (Perú)
 * Base: 280000, 8660000 (zona de Lima)
 */

export const LOTE_TEMPLATES: PlanoTemplate[] = [
  {
    id: 'rectangular-estandar',
    name: 'Lote Rectangular Estándar',
    description: 'Lote rectangular típico de 10x20m (200m²) - Ideal para vivienda unifamiliar',
    category: 'residencial',
    vertices: [
      [280000, 8660000],
      [280010, 8660000],
      [280010, 8660020],
      [280000, 8660020],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 10,
      fondo: 10,
      ladoDerecho: 20,
      ladoIzquierdo: 20,
      area: 200,
      perimetro: 60,
    },
    metadata: {
      codigo: 'PLANTILLA-R01',
      nombre: 'Lote Rectangular 200m²',
      manzana: 'A',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
  {
    id: 'rectangular-grande',
    name: 'Lote Rectangular Grande',
    description: 'Lote rectangular amplio de 15x30m (450m²) - Ideal para vivienda con jardín',
    category: 'residencial',
    vertices: [
      [280000, 8660000],
      [280015, 8660000],
      [280015, 8660030],
      [280000, 8660030],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 15,
      fondo: 15,
      ladoDerecho: 30,
      ladoIzquierdo: 30,
      area: 450,
      perimetro: 90,
    },
    metadata: {
      codigo: 'PLANTILLA-R02',
      nombre: 'Lote Rectangular 450m²',
      manzana: 'B',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
  {
    id: 'esquina',
    name: 'Lote de Esquina',
    description: 'Lote en esquina con dos frentes de 12x18m (216m²) - Doble acceso',
    category: 'residencial',
    vertices: [
      [280000, 8660000],
      [280012, 8660000],
      [280012, 8660018],
      [280000, 8660018],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 12,
      fondo: 12,
      ladoDerecho: 18,
      ladoIzquierdo: 18,
      area: 216,
      perimetro: 60,
    },
    metadata: {
      codigo: 'PLANTILLA-E01',
      nombre: 'Lote Esquina 216m²',
      manzana: 'C',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
  {
    id: 'trapezoidal',
    name: 'Lote Trapezoidal',
    description: 'Lote trapezoidal de 8-12x20m (~200m²) - Terreno irregular común',
    category: 'irregular',
    vertices: [
      [280000, 8660000],
      [280008, 8660000],
      [280012, 8660020],
      [280000, 8660020],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 8,
      fondo: 12,
      ladoDerecho: 20,
      ladoIzquierdo: 20,
      area: 200,
      perimetro: 60,
    },
    metadata: {
      codigo: 'PLANTILLA-T01',
      nombre: 'Lote Trapezoidal 200m²',
      manzana: 'D',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
  {
    id: 'comercial',
    name: 'Lote Comercial',
    description: 'Lote comercial amplio de 20x25m (500m²) - Zona comercial',
    category: 'comercial',
    vertices: [
      [280000, 8660000],
      [280020, 8660000],
      [280020, 8660025],
      [280000, 8660025],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 20,
      fondo: 20,
      ladoDerecho: 25,
      ladoIzquierdo: 25,
      area: 500,
      perimetro: 90,
    },
    metadata: {
      codigo: 'PLANTILLA-C01',
      nombre: 'Lote Comercial 500m²',
      manzana: 'E',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
  {
    id: 'industrial',
    name: 'Lote Industrial',
    description: 'Lote industrial grande de 30x40m (1200m²) - Zona industrial',
    category: 'industrial',
    vertices: [
      [280000, 8660000],
      [280030, 8660000],
      [280030, 8660040],
      [280000, 8660040],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 30,
      fondo: 30,
      ladoDerecho: 40,
      ladoIzquierdo: 40,
      area: 1200,
      perimetro: 140,
    },
    metadata: {
      codigo: 'PLANTILLA-I01',
      nombre: 'Lote Industrial 1200m²',
      manzana: 'F',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
  {
    id: 'l-shape',
    name: 'Lote en Forma de L',
    description: 'Lote irregular en forma de L (~300m²) - Diseño único',
    category: 'irregular',
    vertices: [
      [280000, 8660000],
      [280015, 8660000],
      [280015, 8660010],
      [280010, 8660010],
      [280010, 8660025],
      [280000, 8660025],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 15,
      fondo: 10,
      ladoDerecho: 25,
      ladoIzquierdo: 25,
      area: 300,
      perimetro: 90,
    },
    metadata: {
      codigo: 'PLANTILLA-L01',
      nombre: 'Lote Forma L 300m²',
      manzana: 'G',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
  {
    id: 'pentagono',
    name: 'Lote Pentagonal',
    description: 'Lote pentagonal irregular (~250m²) - Esquina especial',
    category: 'irregular',
    vertices: [
      [280000, 8660000],
      [280012, 8660000],
      [280015, 8660012],
      [280010, 8660025],
      [280000, 8660020],
    ] as UTMCoordinate[],
    dimensiones: {
      frente: 12,
      fondo: 10,
      ladoDerecho: 25,
      ladoIzquierdo: 20,
      area: 250,
      perimetro: 75,
    },
    metadata: {
      codigo: 'PLANTILLA-P01',
      nombre: 'Lote Pentagonal 250m²',
      manzana: 'H',
      etapa: '1',
      numeroLote: '01',
      estado: 'libre',
    },
  },
];

/**
 * Obtiene una plantilla por su ID
 */
export function getTemplateById(id: string): PlanoTemplate | undefined {
  return LOTE_TEMPLATES.find(t => t.id === id);
}

/**
 * Obtiene plantillas por categoría
 */
export function getTemplatesByCategory(category: PlanoTemplate['category']): PlanoTemplate[] {
  return LOTE_TEMPLATES.filter(t => t.category === category);
}

/**
 * Calcula el área aproximada de una plantilla
 */
export function calculateTemplateArea(vertices: UTMCoordinate[]): number {
  if (vertices.length < 3) return 0;

  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    area += vertices[i][0] * vertices[j][1];
    area -= vertices[j][0] * vertices[i][1];
  }
  return Math.abs(area / 2);
}

/**
 * Calcula el perímetro de una plantilla
 */
export function calculateTemplatePerimeter(vertices: UTMCoordinate[]): number {
  if (vertices.length < 2) return 0;

  let perimeter = 0;
  for (let i = 0; i < vertices.length; i++) {
    const j = (i + 1) % vertices.length;
    const dx = vertices[j][0] - vertices[i][0];
    const dy = vertices[j][1] - vertices[i][1];
    perimeter += Math.sqrt(dx * dx + dy * dy);
  }
  return perimeter;
}
