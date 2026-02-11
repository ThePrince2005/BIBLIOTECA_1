const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuración para XAMPP usando variables de entorno
const config = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'biblioteca_escolar',
  port: parseInt(process.env.DB_PORT) || parseInt(process.env.MYSQLPORT) || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  multipleStatements: true,
  timezone: process.env.TZ || '-05:00'
};

// Crear el pool de conexiones
const pool = mysql.createPool(config);

// Función para probar la conexión
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexión exitosa a MySQL');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Usuario: ${config.user}`);
    console.log(`   Base de datos: ${config.database}`);

    // Crear la base de datos si no existe
    await connection.query('CREATE DATABASE IF NOT EXISTS biblioteca_escolar');
    console.log('✅ Base de datos biblioteca_escolar verificada');

    connection.release();
  } catch (error) {
    console.error('\n❌ Error al conectar con MySQL:', error.message);
    console.log('\n📋 Configuración actual:');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Usuario: ${config.user}`);
    console.log(`   Base de datos: ${config.database}`);
    console.log(`   Contraseña: ${config.password ? '***configurada***' : '(vacía)'}`);

    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('\n💡 SOLUCIÓN:');
      console.log('   1. Verifica que XAMPP esté corriendo y MySQL iniciado');
      console.log('   2. Crea o actualiza el archivo .env en la raíz del proyecto');
      console.log('   3. Usa estas credenciales para XAMPP local:');
      console.log('      DB_HOST=localhost');
      console.log('      DB_USER=root');
      console.log('      DB_PASSWORD=');
      console.log('      DB_NAME=biblioteca_escolar');
      console.log('      DB_PORT=3306');
      console.log('\n   📖 Ver ENV_SETUP.md para más detalles\n');
    } else {
      console.log('\n⚠️ Asegúrate de que XAMPP está corriendo y MySQL está iniciado');
    }
    process.exit(1);
  }
};

module.exports = {
  pool,
  testConnection
};
