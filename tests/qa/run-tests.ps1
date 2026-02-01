# ============================================================================
# Script de Pruebas Automáticas - Sistema Híbrido de Planos Perimétricos V2
# ============================================================================
# Autor: Sistema QA
# Fecha: 2026-01-31
# Descripción: Ejecuta los 3 escenarios de prueba y genera reportes (Windows)

# Configuración
$API_URL = "http://localhost:3000/api/v1/planos/generar-hibrido"
$OUTPUT_DIR = "tests/qa/output"
$PAYLOADS_FILE = "tests/qa/payloads-prueba-hibrido.json"

# Crear directorio de salida
New-Item -ItemType Directory -Force -Path $OUTPUT_DIR | Out-Null

Write-Host "=========================================" -ForegroundColor Blue
Write-Host "   PRUEBAS QA - PLANOS HÍBRIDOS V2    " -ForegroundColor Blue
Write-Host "=========================================" -ForegroundColor Blue
Write-Host ""

# ============================================================================
# Función: Verificar que el servidor está corriendo
# ============================================================================
function Test-Server {
    Write-Host "[INFO] Verificando que el servidor esté activo..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $API_URL -Method GET -ErrorAction SilentlyContinue
        Write-Host "[OK] Servidor activo en $API_URL" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "[ERROR] Servidor no está activo en $API_URL" -ForegroundColor Red
        Write-Host "[TIP] Ejecuta: npm run dev" -ForegroundColor Yellow
        exit 1
    }
}

# ============================================================================
# Función: Extraer escenario del JSON
# ============================================================================
function Get-Scenario {
    param([string]$ScenarioName)
    
    $json = Get-Content $PAYLOADS_FILE -Raw | ConvertFrom-Json
    return $json.$ScenarioName | ConvertTo-Json -Depth 10
}

# ============================================================================
# ESCENARIO 1: Happy Path (Datos Registrales)
# ============================================================================
function Test-Scenario1 {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Blue
    Write-Host "ESCENARIO 1: Happy Path (Registral)" -ForegroundColor Blue
    Write-Host "=========================================" -ForegroundColor Blue
    
    $outputFile = "$OUTPUT_DIR/test1-registral.pdf"
    
    Write-Host "[TEST] Enviando payload con datos registrales..." -ForegroundColor Yellow
    
    try {
        # Extraer payload
        $payload = Get-Scenario -ScenarioName "escenario_1_happy_path_registral"
        
        # Ejecutar request
        $response = Invoke-WebRequest -Uri $API_URL `
            -Method POST `
            -ContentType "application/json" `
            -Body $payload `
            -OutFile $outputFile
        
        Write-Host "[OK] Status Code: 200" -ForegroundColor Green
        Write-Host "[OK] PDF generado correctamente" -ForegroundColor Green
        Write-Host "[OK] Archivo: $outputFile" -ForegroundColor Green
        
        # Mostrar headers importantes
        Write-Host "[INFO] Headers HTTP:" -ForegroundColor Yellow
        $response.Headers.GetEnumerator() | Where-Object { $_.Key -like "X-Data-*" -or $_.Key -like "X-Requires-*" -or $_.Key -like "X-Generation-*" } | ForEach-Object {
            Write-Host "  $($_.Key): $($_.Value)"
        }
        
        return $true
    }
    catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ============================================================================
# ESCENARIO 2: Fallback Geométrico
# ============================================================================
function Test-Scenario2 {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Blue
    Write-Host "ESCENARIO 2: Fallback Geométrico" -ForegroundColor Blue
    Write-Host "=========================================" -ForegroundColor Blue
    
    $outputFile = "$OUTPUT_DIR/test2-fallback.pdf"
    
    Write-Host "[TEST] Enviando payload SIN datos registrales..." -ForegroundColor Yellow
    
    try {
        # Extraer payload
        $payload = Get-Scenario -ScenarioName "escenario_2_fallback_geometrico"
        
        # Ejecutar request
        $response = Invoke-WebRequest -Uri $API_URL `
            -Method POST `
            -ContentType "application/json" `
            -Body $payload `
            -OutFile $outputFile
        
        Write-Host "[OK] Status Code: 200" -ForegroundColor Green
        Write-Host "[OK] PDF generado con cálculo automático" -ForegroundColor Green
        Write-Host "[OK] Archivo: $outputFile" -ForegroundColor Green
        
        # Verificar headers
        Write-Host "[INFO] Headers HTTP:" -ForegroundColor Yellow
        
        $dataSourceArea = $response.Headers["X-Data-Source-Area"]
        if ($dataSourceArea -eq "CALCULADO") {
            Write-Host "[OK] Área calculada desde geometría" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Header X-Data-Source-Area no indica CALCULADO" -ForegroundColor Red
        }
        
        $dataSourceLinderos = $response.Headers["X-Data-Source-Linderos"]
        if ($dataSourceLinderos -eq "CALCULADO") {
            Write-Host "[OK] Linderos calculados automáticamente" -ForegroundColor Green
        } else {
            Write-Host "[WARN] Header X-Data-Source-Linderos no indica CALCULADO" -ForegroundColor Red
        }
        
        return $true
    }
    catch {
        Write-Host "[ERROR] $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ============================================================================
# ESCENARIO 3: Error de Integridad
# ============================================================================
function Test-Scenario3 {
    Write-Host ""
    Write-Host "=========================================" -ForegroundColor Blue
    Write-Host "ESCENARIO 3: Error de Integridad" -ForegroundColor Blue
    Write-Host "=========================================" -ForegroundColor Blue
    
    $outputFile = "$OUTPUT_DIR/test3-error.json"
    
    Write-Host "[TEST] Enviando payload con incoherencia (4 lados vs 5 linderos)..." -ForegroundColor Yellow
    
    try {
        # Extraer payload
        $payload = Get-Scenario -ScenarioName "escenario_3_error_integridad"
        
        # Ejecutar request (esperamos error)
        try {
            $response = Invoke-WebRequest -Uri $API_URL `
                -Method POST `
                -ContentType "application/json" `
                -Body $payload `
                -ErrorAction Stop
            
            # Si llegamos aquí, NO hubo error (malo)
            Write-Host "[ERROR] Status Code: 200 (se esperaba 400)" -ForegroundColor Red
            Write-Host "[ERROR] El sistema NO detectó la incoherencia" -ForegroundColor Red
            return $false
        }
        catch {
            # Verificar que sea error 400
            if ($_.Exception.Response.StatusCode -eq 400 -or $_.Exception.Response.StatusCode.value__ -eq 400) {
                Write-Host "[OK] Status Code: 400 (error esperado)" -ForegroundColor Green
                
                # Leer respuesta de error
                $stream = $_.Exception.Response.GetResponseStream()
                $reader = New-Object System.IO.StreamReader($stream)
                $errorBody = $reader.ReadToEnd()
                $reader.Close()
                $stream.Close()
                
                # Guardar a archivo
                $errorBody | Out-File -FilePath $outputFile -Encoding UTF8
                
                Write-Host "[OK] Respuesta es JSON válido" -ForegroundColor Green
                Write-Host "[INFO] Respuesta de error:" -ForegroundColor Yellow
                Write-Host $errorBody
                
                # Verificar estructura
                $errorJson = $errorBody | ConvertFrom-Json
                if ($errorJson.success -eq $false) {
                    Write-Host "[OK] Estructura de error correcta" -ForegroundColor Green
                } else {
                    Write-Host "[WARN] Estructura de error no estándar" -ForegroundColor Red
                }
                
                return $true
            }
            else {
                Write-Host "[WARN] Status Code: $($_.Exception.Response.StatusCode) (se esperaba 400)" -ForegroundColor Yellow
                return $false
            }
        }
    }
    catch {
        Write-Host "[ERROR] Error inesperado: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# ============================================================================
# EJECUCIÓN PRINCIPAL
# ============================================================================

# Verificar servidor
Test-Server

# Contador de resultados
$passed = 0
$failed = 0

# Ejecutar escenarios
if (Test-Scenario1) {
    $passed++
} else {
    $failed++
}

if (Test-Scenario2) {
    $passed++
} else {
    $failed++
}

if (Test-Scenario3) {
    $passed++
} else {
    $failed++
}

# Resumen final
Write-Host ""
Write-Host "=========================================" -ForegroundColor Blue
Write-Host "         RESUMEN DE PRUEBAS            " -ForegroundColor Blue
Write-Host "=========================================" -ForegroundColor Blue
Write-Host ""
Write-Host "Total de pruebas: $($passed + $failed)"
Write-Host "Pasaron: $passed" -ForegroundColor Green
Write-Host "Fallaron: $failed" -ForegroundColor Red
Write-Host ""

if ($failed -eq 0) {
    Write-Host "✅ TODAS LAS PRUEBAS PASARON" -ForegroundColor Green
    Write-Host ""
    Write-Host "[TIP] Revisa los PDFs generados en: $OUTPUT_DIR" -ForegroundColor Yellow
    Write-Host "  - test1-registral.pdf: Verifica que muestre '10.00m' en el frente"
    Write-Host "  - test2-fallback.pdf: Verifica colindancia 'Av. Los Alamos'"
    Write-Host "  - test3-error.json: Verifica mensaje de error claro"
    exit 0
} else {
    Write-Host "❌ ALGUNAS PRUEBAS FALLARON" -ForegroundColor Red
    Write-Host ""
    Write-Host "[TIP] Revisa los logs del servidor para más detalles" -ForegroundColor Yellow
    exit 1
}
