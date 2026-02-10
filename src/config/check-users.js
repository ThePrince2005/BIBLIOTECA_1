const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkUsers() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: {
            rejectUnauthorized: false
        }
    });

    try {
        console.log('🔍 Consultando usuarios registrados...\n');
        
        const [users] = await connection.query(
            'SELECT id, nombre, correo, dni, rol, area_docente FROM usuarios'
        );

        console.log('Usuarios en el sistema:');
        users.forEach(user => {
            console.log('\n-------------------');
            console.log(`ID: ${user.id}`);
            console.log(`Nombre: ${user.nombre}`);
            console.log(`Correo: ${user.correo}`);
            console.log(`DNI: ${user.dni}`);
            console.log(`Rol: ${user.rol}`);
            if (user.area_docente) {
                console.log(`Área: ${user.area_docente}`);
            }
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

checkUsers();