const mysql = require('mysql2/promise');

async function countEstudiantes() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'biblioteca_escolar'
  });

  try {
    const [rows] = await connection.execute(
      'SELECT COUNT(*) as total FROM usuarios WHERE rol = ?', 
      ['estudiante']
    );
    console.log(`Total de estudiantes en la base de datos: ${rows[0].total}`);
  } catch (error) {
    console.error('Error al contar estudiantes:', error);
  } finally {
    await connection.end();
  }
}

countEstudiantes();
