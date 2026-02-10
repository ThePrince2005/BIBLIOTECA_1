const { pool } = require('./src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
    console.log('Running migration...');
    const migrationPath = path.join(__dirname, 'src', 'config', 'migrations', 'create_documentos_table.sql');
    try {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        const statements = sql.split(';').filter(stmt => stmt.trim());

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            for (const statement of statements) {
                if (statement.trim()) {
                    await connection.query(statement);
                    console.log('Executed:', statement.substring(0, 50) + '...');
                }
            }
            await connection.commit();
            console.log('Migration completed successfully.');
        } catch (err) {
            await connection.rollback();
            console.error('Migration failed:', err);
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error reading migration file:', error);
    } finally {
        process.exit();
    }
}

runMigration();
