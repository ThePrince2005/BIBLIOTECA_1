/**
 * Validador de variables de entorno
 * Verifica que todas las variables críticas estén configuradas
 */

const requiredEnvVars = {
  development: [],
  production: ['JWT_SECRET', 'SESSION_SECRET', 'DB_HOST', 'DB_USER', 'DB_NAME']
};

const recommendedEnvVars = [
  'DB_PASSWORD',
  'EMAIL_HOST',
  'EMAIL_USER',
  'EMAIL_PASS'
];

/**
 * Valida las variables de entorno requeridas
 * @param {string} env - Entorno (development, production)
 * @returns {Object} Resultado de la validación
 */
function validateEnvVars(env = process.env.NODE_ENV || 'development') {
  const errors = [];
  const warnings = [];
  const required = requiredEnvVars[env] || requiredEnvVars.development;

  // Validar variables requeridas
  // Validar variables requeridas (Soporte para Railway automatizado)
  const envMap = {
    'DB_HOST': ['DB_HOST', 'MYSQLHOST'],
    'DB_USER': ['DB_USER', 'MYSQLUSER'],
    'DB_NAME': ['DB_NAME', 'MYSQLDATABASE'],
    'JWT_SECRET': ['JWT_SECRET'],
    'SESSION_SECRET': ['SESSION_SECRET']
  };

  required.forEach(varName => {
    // Si la variable tiene alternativas (ej. DB_HOST o MYSQLHOST), verificar si alguna existe
    if (envMap[varName]) {
      const hasDefinedVar = envMap[varName].some(v => process.env[v]);
      if (!hasDefinedVar) {
        errors.push(`Variable requerida faltante: ${varName} (o su alternativa ${envMap[varName].join('/')})`);
      }
    } else if (!process.env[varName]) {
      // Fallback para variables sin mapeo explícito
      errors.push(`Variable de entorno requerida faltante: ${varName}`);
    }
  });

  // Verificar variables recomendadas
  recommendedEnvVars.forEach(varName => {
    if (!process.env[varName]) {
      warnings.push(`Variable de entorno recomendada no configurada: ${varName}`);
    }
  });

  // Validaciones específicas
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET debería tener al menos 32 caracteres para mayor seguridad');
  }

  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    warnings.push('SESSION_SECRET debería tener al menos 32 caracteres para mayor seguridad');
  }

  if (process.env.DB_PASSWORD === '' && env === 'production') {
    warnings.push('DB_PASSWORD está vacío. Asegúrate de configurar una contraseña en producción');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Muestra un resumen de la validación en consola
 */
function printValidationSummary() {
  const env = process.env.NODE_ENV || 'development';
  const validation = validateEnvVars(env);

  if (validation.errors.length > 0) {
    console.error('\n❌ ERRORES EN VARIABLES DE ENTORNO:');
    validation.errors.forEach(error => console.error(`   - ${error}`));
    console.error('\n⚠️  Por favor, configura las variables faltantes en tu archivo .env\n');
  }

  if (validation.warnings.length > 0 && env === 'development') {
    console.warn('\n⚠️  ADVERTENCIAS:');
    validation.warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }

  if (validation.isValid && validation.warnings.length === 0) {
    console.log('✅ Variables de entorno validadas correctamente');
  }

  return validation;
}

module.exports = {
  validateEnvVars,
  printValidationSummary
};



