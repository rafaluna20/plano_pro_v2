#!/bin/bash

# ============================================================================
# Script de Pruebas Automáticas - Sistema Híbrido de Planos Perimétricos V2
# ============================================================================
# Autor: Sistema QA
# Fecha: 2026-01-31
# Descripción: Ejecuta los 3 escenarios de prueba y genera reportes

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración
API_URL="http://localhost:3000/api/v1/planos/generar-hibrido"
OUTPUT_DIR="tests/qa/output"
PAYLOADS_FILE="tests/qa/payloads-prueba-hibrido.json"

# Crear directorio de salida
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}   PRUEBAS QA - PLANOS HÍBRIDOS V2    ${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""

# ============================================================================
# Función: Verificar que el servidor está corriendo
# ============================================================================
check_server() {
    echo -e "${YELLOW}[INFO]${NC} Verificando que el servidor esté activo..."
    
    if curl -s -o /dev/null -w "%{http_code}" "$API_URL" | grep -q "200\|404"; then
        echo -e "${GREEN}[OK]${NC} Servidor activo en $API_URL"
        return 0
    else
        echo -e "${RED}[ERROR]${NC} Servidor no está activo en $API_URL"
        echo -e "${YELLOW}[TIP]${NC} Ejecuta: npm run dev"
        exit 1
    fi
}

# ============================================================================
# Función: Extraer escenario del JSON
# ============================================================================
extract_scenario() {
    local scenario=$1
    echo $(cat "$PAYLOADS_FILE" | jq ".$scenario")
}

# ============================================================================
# ESCENARIO 1: Happy Path (Datos Registrales)
# ============================================================================
test_scenario_1() {
    echo ""
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}ESCENARIO 1: Happy Path (Registral)${NC}"
    echo -e "${BLUE}=======================================${NC}"
    
    local output_file="$OUTPUT_DIR/test1-registral.pdf"
    local headers_file="$OUTPUT_DIR/test1-headers.txt"
    
    echo -e "${YELLOW}[TEST]${NC} Enviando payload con datos registrales..."
    
    # Extraer payload
    local payload=$(extract_scenario "escenario_1_happy_path_registral")
    
    # Ejecutar request y guardar headers
    http_code=$(echo "$payload" | curl -s -o "$output_file" -w "%{http_code}" \
        -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -D "$headers_file" \
        -d @-)
    
    # Verificar resultado
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}[OK]${NC} Status Code: 200"
        
        # Verificar que es un PDF válido
        if file "$output_file" | grep -q "PDF"; then
            echo -e "${GREEN}[OK]${NC} PDF generado correctamente"
            echo -e "${GREEN}[OK]${NC} Archivo: $output_file"
            
            # Mostrar headers importantes
            echo -e "${YELLOW}[INFO]${NC} Headers HTTP:"
            grep -i "X-Data-Source" "$headers_file" || echo "  (Headers no encontrados)"
            grep -i "X-Requires-Review" "$headers_file" || true
            grep -i "X-Generation-Time" "$headers_file" || true
            
            return 0
        else
            echo -e "${RED}[ERROR]${NC} Archivo generado no es un PDF válido"
            return 1
        fi
    else
        echo -e "${RED}[ERROR]${NC} Status Code: $http_code (esperado: 200)"
        cat "$output_file"
        return 1
    fi
}

# ============================================================================
# ESCENARIO 2: Fallback Geométrico
# ============================================================================
test_scenario_2() {
    echo ""
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}ESCENARIO 2: Fallback Geométrico${NC}"
    echo -e "${BLUE}=======================================${NC}"
    
    local output_file="$OUTPUT_DIR/test2-fallback.pdf"
    local headers_file="$OUTPUT_DIR/test2-headers.txt"
    
    echo -e "${YELLOW}[TEST]${NC} Enviando payload SIN datos registrales..."
    
    # Extraer payload
    local payload=$(extract_scenario "escenario_2_fallback_geometrico")
    
    # Ejecutar request
    http_code=$(echo "$payload" | curl -s -o "$output_file" -w "%{http_code}" \
        -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -D "$headers_file" \
        -d @-)
    
    # Verificar resultado
    if [ "$http_code" = "200" ]; then
        echo -e "${GREEN}[OK]${NC} Status Code: 200"
        
        if file "$output_file" | grep -q "PDF"; then
            echo -e "${GREEN}[OK]${NC} PDF generado con cálculo automático"
            echo -e "${GREEN}[OK]${NC} Archivo: $output_file"
            
            # Verificar que los headers indican cálculo
            echo -e "${YELLOW}[INFO]${NC} Headers HTTP:"
            if grep -q "X-Data-Source-Area: CALCULADO" "$headers_file"; then
                echo -e "${GREEN}[OK]${NC} Área calculada desde geometría"
            else
                echo -e "${RED}[WARN]${NC} Header X-Data-Source-Area no indica CALCULADO"
            fi
            
            if grep -q "X-Data-Source-Linderos: CALCULADO" "$headers_file"; then
                echo -e "${GREEN}[OK]${NC} Linderos calculados automáticamente"
            else
                echo -e "${RED}[WARN]${NC} Header X-Data-Source-Linderos no indica CALCULADO"
            fi
            
            return 0
        else
            echo -e "${RED}[ERROR]${NC} Archivo generado no es un PDF válido"
            return 1
        fi
    else
        echo -e "${RED}[ERROR]${NC} Status Code: $http_code (esperado: 200)"
        cat "$output_file"
        return 1
    fi
}

# ============================================================================
# ESCENARIO 3: Error de Integridad
# ============================================================================
test_scenario_3() {
    echo ""
    echo -e "${BLUE}=======================================${NC}"
    echo -e "${BLUE}ESCENARIO 3: Error de Integridad${NC}"
    echo -e "${BLUE}=======================================${NC}"
    
    local output_file="$OUTPUT_DIR/test3-error.json"
    
    echo -e "${YELLOW}[TEST]${NC} Enviando payload con incoherencia (4 lados vs 5 linderos)..."
    
    # Extraer payload
    local payload=$(extract_scenario "escenario_3_error_integridad")
    
    # Ejecutar request
    http_code=$(echo "$payload" | curl -s -o "$output_file" -w "%{http_code}" \
        -X POST "$API_URL" \
        -H "Content-Type: application/json" \
        -d @-)
    
    # Verificar resultado
    if [ "$http_code" = "400" ]; then
        echo -e "${GREEN}[OK]${NC} Status Code: 400 (error esperado)"
        
        # Verificar que es JSON
        if cat "$output_file" | jq . > /dev/null 2>&1; then
            echo -e "${GREEN}[OK]${NC} Respuesta es JSON válido"
            
            # Mostrar mensaje de error
            echo -e "${YELLOW}[INFO]${NC} Respuesta de error:"
            cat "$output_file" | jq .
            
            # Verificar estructura
            if cat "$output_file" | jq -e '.success == false' > /dev/null; then
                echo -e "${GREEN}[OK]${NC} Estructura de error correcta"
            else
                echo -e "${RED}[WARN]${NC} Estructura de error no estándar"
            fi
            
            return 0
        else
            echo -e "${RED}[ERROR]${NC} Respuesta no es JSON válido"
            cat "$output_file"
            return 1
        fi
    elif [ "$http_code" = "200" ]; then
        echo -e "${RED}[ERROR]${NC} Status Code: 200 (se esperaba 400)"
        echo -e "${RED}[ERROR]${NC} El sistema NO detectó la incoherencia"
        return 1
    else
        echo -e "${YELLOW}[WARN]${NC} Status Code: $http_code (se esperaba 400)"
        cat "$output_file"
        return 1
    fi
}

# ============================================================================
# EJECUCIÓN PRINCIPAL
# ============================================================================

# Verificar servidor
check_server

# Contador de resultados
PASSED=0
FAILED=0

# Ejecutar escenarios
if test_scenario_1; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_scenario_2; then
    ((PASSED++))
else
    ((FAILED++))
fi

if test_scenario_3; then
    ((PASSED++))
else
    ((FAILED++))
fi

# Resumen final
echo ""
echo -e "${BLUE}=======================================${NC}"
echo -e "${BLUE}         RESUMEN DE PRUEBAS            ${NC}"
echo -e "${BLUE}=======================================${NC}"
echo ""
echo -e "Total de pruebas: $((PASSED + FAILED))"
echo -e "${GREEN}Pasaron: $PASSED${NC}"
echo -e "${RED}Fallaron: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ TODAS LAS PRUEBAS PASARON${NC}"
    echo ""
    echo -e "${YELLOW}[TIP]${NC} Revisa los PDFs generados en: $OUTPUT_DIR"
    echo -e "  - test1-registral.pdf: Verifica que muestre '10.00m' en el frente"
    echo -e "  - test2-fallback.pdf: Verifica colindancia 'Av. Los Alamos'"
    echo -e "  - test3-error.json: Verifica mensaje de error claro"
    exit 0
else
    echo -e "${RED}❌ ALGUNAS PRUEBAS FALLARON${NC}"
    echo ""
    echo -e "${YELLOW}[TIP]${NC} Revisa los logs del servidor para más detalles"
    exit 1
fi
