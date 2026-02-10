# Script para configurar .env para desarrollo local con XAMPP
Write-Host "🔧 Configurando archivo .env para desarrollo local..." -ForegroundColor Cyan

$envContent = @"
# Configuración del Servidor
PORT=3000
NODE_ENV=development

# ============================================================================
# CONFIGURACIÓN PARA XAMPP LOCAL (Desarrollo)
# ============================================================================
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=biblioteca_escolar
DB_PORT=3306

# ============================================================================
# CONFIGURACIÓN PARA CLEVER CLOUD (Producción) - COMENTADO
# Descomenta estas líneas y comenta las de arriba si quieres usar Clever Cloud
# ============================================================================
# DB_HOST=b2aaeo3tkn0gkkcqrpy5-mysql.services.clever-cloud.com
# DB_USER=ufztbhpy9wsyfumn
# DB_PASSWORD=npTXFSdSKABD3JskNq7o
# DB_NAME=b2aaeo3tkn0gkkcqrpy5
# DB_PORT=3306

# Configuración de Seguridad
# IMPORTANTE: Genera secretos seguros para producción usando:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=tu_clave_secreta_muy_segura_cambiar_en_produccion
SESSION_SECRET=otra_clave_secreta_para_cookies_cambiar_en_produccion
JWT_EXPIRES_IN=24h

# Configuración de Email (Opcional - para notificaciones)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=
EMAIL_FROM=noreply@biblioteca-escolar.com

# Configuración de Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Timezone
TZ=America/Lima

# Para deshabilitar rate limiting en desarrollo (opcional)
# DISABLE_RATE_LIMIT=true
"@

# Crear backup del .env actual si existe
if (Test-Path .env) {
    $timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
    $backupName = ".env.backup.$timestamp"
    Copy-Item .env $backupName
    Write-Host "Backup creado: $backupName" -ForegroundColor Green
}

# Escribir el nuevo contenido
$envContent | Out-File -FilePath .env -Encoding utf8 -NoNewline

Write-Host "✅ Archivo .env actualizado para desarrollo local con XAMPP" -ForegroundColor Green
Write-Host ""
Write-Host "📋 Configuración aplicada:" -ForegroundColor Yellow
Write-Host "   - Host: localhost" -ForegroundColor White
Write-Host "   - Usuario: root" -ForegroundColor White
Write-Host "   - Contraseña: (vacía)" -ForegroundColor White
Write-Host "   - Base de datos: biblioteca_escolar" -ForegroundColor White
Write-Host ""
Write-Host "⚠️  Asegúrate de que XAMPP esté corriendo y MySQL iniciado" -ForegroundColor Yellow
Write-Host ""

