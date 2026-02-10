const fs = require('fs');
const csv = require('csv-parser');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Configuración de la conexión a la base de datos
const dbConfig = {
  host: process.env.DB_HOST || 'localhost', 
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'biblioteca_escolar',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Ruta al archivo CSV (ruta absoluta para Windows)
const CSV_FILE_PATH = 'e:/xampp/htdocs/BIBLIOTECAA/estudiantes.csv';

// Función para conectar a la base de datos
async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// Función para hashear la contraseña
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
}

// Función principal
async function importarEstudiantes() {
  const connection = await getConnection();
  
  try {
    console.log('Iniciando importación de estudiantes...');
    
    // Leer y procesar el archivo CSV
    const estudiantes = [];
    
    await new Promise((resolve, reject) => {
      fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv({
          separator: ';', // Especificar que el separador es punto y coma
          headers: ['dni', 'apellidos', 'nombres', 'grado', 'seccion'],
          skipLines: 0, // Si la primera línea son encabezados, la incluye
          mapHeaders: ({ header }) => header.toLowerCase()
        }))
        .on('data', (data) => {
          // Limpiar los datos
          const estudiante = {
            dni: data.dni ? data.dni.trim() : '',
            apellidos: data.apellidos ? data.apellidos.trim() : '',
            nombres: data.nombres ? data.nombres.trim() : '',
            grado: data.grado ? parseInt(data.grado) || 1 : 1,
            seccion: data.seccion ? data.seccion.trim().toUpperCase() : 'A'
          };
          
          if (estudiante.dni) {
            estudiantes.push(estudiante);
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Se encontraron ${estudiantes.length} estudiantes para importar.`);
    
    // Procesar cada estudiante
    for (const estudiante of estudiantes) {
      try {
        // Verificar si el usuario ya existe
        const [rows] = await connection.execute(
          'SELECT id FROM usuarios WHERE dni = ?',
          [estudiante.dni]
        );

        if (rows.length > 0) {
          console.log(`El estudiante con DNI ${estudiante.dni} ya existe. Actualizando...`);
            
            // Obtener el nombre completo de la sección (tomar el último campo después de dividir por ';')
            const seccionCompleta = estudiante.seccion.trim().toUpperCase();
            console.log(`Procesando estudiante DNI ${estudiante.dni} - Sección: ${seccionCompleta}`);
            
            await connection.execute(
              `UPDATE usuarios SET 
                nombre = CONCAT(?, ' ', ?),
                correo = ?,
                grado = ?,
                seccion = ?,
                rol = 'estudiante',
                updated_at = NOW()
              WHERE dni = ?`,
              [
                estudiante.nombres,
                estudiante.apellidos,
                `${estudiante.dni}@bibliotecadh.com`,
                estudiante.grado,
                seccionCompleta,  // Usamos la sección completa
                estudiante.dni
              ]
            );
        } else {
          // Insertar nuevo estudiante
          const passwordHash = await hashPassword(estudiante.dni);
          
          // Guardar el nombre completo de la sección
          const nombreCompletoSeccion = estudiante.seccion.trim().toUpperCase();
          
          await connection.execute(
            `INSERT INTO usuarios 
              (nombre, correo, contrasena, dni, rol, grado, seccion, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'estudiante', ?, ?, NOW(), NOW())`,
            [
              `${estudiante.nombres} ${estudiante.apellidos}`.trim(),
              `${estudiante.dni}@bibliotecadh.com`,
              passwordHash,
              estudiante.dni,
              estudiante.grado,
              nombreCompletoSeccion  // Guardamos el nombre completo de la sección
            ]
          );
          
          console.log(`Estudiante ${estudiante.nombres} ${estudiante.apellidos} importado.`);
        }
      } catch (error) {
        console.error(`Error al procesar el estudiante con DNI ${estudiante.dni}:`, error.message);
      }
    }
    
    console.log('Importación completada con éxito.');
  } catch (error) {
    console.error('Error durante la importación:', error);
  } finally {
    // Cerrar la conexión
    if (connection) await connection.end();
    process.exit();
  }
}

// Ejecutar la importación
importarEstudiantes();
