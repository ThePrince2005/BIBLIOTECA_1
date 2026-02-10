const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkTableStructure() {
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
        console.log('🔍 Verificando estructura de la tabla usuarios...');
        
        // Obtener estructura de la tabla
        const [columns] = await connection.query('SHOW COLUMNS FROM usuarios');
        console.log('\nEstructura de la tabla usuarios:');
        columns.forEach(column => {
            console.log(`${column.Field}: ${column.Type} ${column.Null === 'NO' ? 'NOT NULL' : ''} ${column.Key === 'PRI' ? 'PRIMARY KEY' : ''} ${column.Default ? `DEFAULT ${column.Default}` : ''}`);
        });

        // Obtener información de índices
        const [indexes] = await connection.query('SHOW INDEX FROM usuarios');
        console.log('\nÍndices de la tabla usuarios:');
        indexes.forEach(index => {
            console.log(`${index.Key_name}: ${index.Column_name} (${index.Index_type})`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await connection.end();
    }
}

checkTableStructure();