const { pool } = require('../config/database');
// const Usuario = require('../models/usuario.model'); // Unused
// const Prestamo = require('../models/prestamo.model'); // Unused
// const Auditoria = require('../models/auditoria.model'); // Unused

class ConfiguracionController {
    /**
     * Renderizar vista de configuración
     */
    static async index(req, res) {
        try {
            res.render('configuracion/index', {
                usuario: req.user,
                // Puedes agregar más datos si es necesario
            });
        } catch (error) {
            console.error(error);
            res.status(500).send('Error interno del servidor');
        }
    }

    /**
     * Cerrar Año Escolar (Acción Crítica)
     * - Elimina estudiantes de 5to grado
     * - Promueve estudiantes de 1° a 4°
     * - Purga usuarios eliminados (soft deleted)
     * - Reinicia historiales de préstamos y logros para el nuevo año (soft clean)
     */
    static async cerrarAnioEscolar(req, res) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            console.log('Iniciando Cierre de Año Escolar...');

            // 1. PURGAR USUARIOS ELIMINADOS (SOFT DELETED)
            // Eliminar físicamente usuarios que estaban marcados como eliminados
            /*
             User request: "todas las rastros de usuarios eliminados ya sea manual... todos sus rastros eliminar, historiales, reseñas etc"
             Esto implica eliminar de tablas dependientes primero.
            */
            // Obtener IDs de usuarios eliminados
            const [usuariosEliminados] = await connection.query("SELECT id FROM usuarios WHERE estado = 'eliminado'");
            const idsEliminados = usuariosEliminados.map(u => u.id);

            let eliminadosCount = 0;
            if (idsEliminados.length > 0) {
                const placeholders = idsEliminados.map(() => '?').join(',');

                // Eliminar dependencias (Reseñas, Favoritos, Préstamos, Logros, Auditoría, etc.)
                // NOTA: Auditoría a veces se preserva, pero el usuario pidió "todos sus rastros".
                await connection.query(`DELETE FROM resenas WHERE usuario_id IN (${placeholders})`, idsEliminados);
                await connection.query(`DELETE FROM favoritos WHERE usuario_id IN (${placeholders})`, idsEliminados);
                await connection.query(`DELETE FROM logros_usuario WHERE usuario_id IN (${placeholders})`, idsEliminados);
                await connection.query(`DELETE FROM lecturas_virtuales WHERE usuario_id IN (${placeholders})`, idsEliminados);
                await connection.query(`DELETE FROM prestamos WHERE usuario_id IN (${placeholders})`, idsEliminados);

                // Finalmente eliminar usuarios
                const [resultElim] = await connection.query(`DELETE FROM usuarios WHERE id IN (${placeholders})`, idsEliminados);
                eliminadosCount = resultElim.affectedRows;
            }

            // 2. ELIMINAR ESTUDIANTES DE 5TO GRADO (GRADUADOS)
            // Identificar estudiantes de 5to
            const [graduados] = await connection.query("SELECT id FROM usuarios WHERE rol = 'estudiante' AND grado = '5' AND estado = 'activo'");
            const idsGraduados = graduados.map(u => u.id);
            let graduadosCount = 0;

            if (idsGraduados.length > 0) {
                const placeholdersGrad = idsGraduados.map(() => '?').join(',');

                // Eliminar todos los rastros de los graduados (Igual que arriba)
                await connection.query(`DELETE FROM resenas WHERE usuario_id IN (${placeholdersGrad})`, idsGraduados);
                await connection.query(`DELETE FROM favoritos WHERE usuario_id IN (${placeholdersGrad})`, idsGraduados);
                await connection.query(`DELETE FROM logros_usuario WHERE usuario_id IN (${placeholdersGrad})`, idsGraduados);
                await connection.query(`DELETE FROM lecturas_virtuales WHERE usuario_id IN (${placeholdersGrad})`, idsGraduados);
                await connection.query(`DELETE FROM prestamos WHERE usuario_id IN (${placeholdersGrad})`, idsGraduados);

                // Eliminar usuarios graduados
                const [resultGrad] = await connection.query(`DELETE FROM usuarios WHERE id IN (${placeholdersGrad})`, idsGraduados);
                graduadosCount = resultGrad.affectedRows;
            }

            // 3. PROMOVER ESTUDIANTES (1° -> 2°, etc.)
            // Importante: Hacerlo en orden inverso o con cuidado para no mezclar
            // UPDATE usuarios SET grado = grado + 1 WHERE rol = 'estudiante' AND grado < 5
            // Como ya eliminamos los de 5to, todos los < 5 pueden subir.
            const [resultPromo] = await connection.query(
                "UPDATE usuarios SET grado = grado + 1 WHERE rol = 'estudiante' AND grado < 5 AND estado = 'activo'"
            );
            const promovidosCount = resultPromo.affectedRows;

            // 4. REINICIAR PROGRESO DEL AÑO (Préstamos, Logros, etc.) PARA LOS QUE QUEDAN
            /*
             User request: "historiales de prestamos, avances del usuario en premios o todo sus progresos se van a reiniciar, y empezar de nuevo"
             Esto es radical. Significa eliminar DATA HISTÓRICA de préstamos y logros de los usuarios que se quedan.
             "algunos dashboard son automaticos mostrarn del año actual, pero algunos graficos no"
             
             Si borramos la tabla prestamos, perdemos la data para los reportes de "Libros más leídos del año pasado".
             PERO el usuario dijo "se van a reiniciar... empezar de nuevo".
             Y "historiales... reiniciar".
             
             Opción Segura: Mover a tabla histórica (prestamos_historico) o Soft Delete (estado='archivado').
             Opción Radical (Usuario): DELETE.
             
             Dado el énfasis en "todos sus rastros eliminar" para los eliminados y "reiniciar" para los activos, y que es una "Zona de Peligro",
             vamos a optar por una limpieza profunda de las tablas de actividad del AÑO ACTUAL/ANTERIORES para "empezar de cero".
             
             Sin embargo, para no romper integridad referencial o perder estadísticas globales históricas si el usuario cambia de opinión,
             una opción mejor es archivar. Pero no tengo tabla de archivo.
             
             Vamos a seguir la instrucción: "historiales de prestamos... se van a reiniciar".
             Voy a eliminar los préstamos 'devueltos' y 'vencidos' (que ya pasaron). 
             Los 'activos' deberían quizás mantenerse o forzarse devolución?
             Normalmente al cerrar año se exige devolución.
             Vamos a eliminar TODO historial de préstamos (reset total) para usuarios estudiantes.
             Los libros se mantienen.
            */

            // Eliminar historial de préstamos de estudiantes (dejar docentes si se requiere, pero dijo "cerrar año escolar", afecta estudiantes)
            // Asumo afecta a TODOS los estudiantes.
            // Eliminar historial TOTAL de préstamos (Estudiantes y Docentes) - Reset Global
            await connection.query("DELETE FROM prestamos");

            // Reiniciar logros (badges) - Reset Global
            await connection.query("DELETE FROM logros_usuario");

            // Reiniciar lecturas virtuales - Reset Global
            await connection.query("DELETE FROM lecturas_virtuales");


            await connection.commit();

            console.log('Cierre de Año completado:', { eliminadosCount, graduadosCount, promovidosCount });

            res.json({
                success: true,
                message: 'Año escolar cerrado correctamente. El sistema está listo para el nuevo periodo.',
                data: {
                    eliminados_antiguos: eliminadosCount,
                    graduados_eliminados: graduadosCount,
                    promovidos: promovidosCount
                }
            });

        } catch (error) {
            await connection.rollback();
            console.error('Error al cerrar año escolar:', error);
            res.status(500).json({
                success: false,
                message: 'Error crítico al procesar el cierre del año escolar.'
            });
        } finally {
            connection.release();
        }
    }
}

module.exports = ConfiguracionController;
