const { pool } = require('../config/database');

class RankingModel {
    /**
     * Retorna ranking de usuarios por número de libros leídos (devoluciones registradas)
     */
    /**
     * Retorna ranking de usuarios por número de libros leídos con filtros opcionales
     */
    static async obtenerRankingLectores(options = {}) {
        const {
            limit = 10,
            fechaInicio,
            fechaFin,
            grado,
            busqueda,
            tipo = 'estudiante' // Por defecto estudiantes
        } = options;
        const params = [];

        // --- LOGICA UNIFICADA (Recursión) ---
        if (tipo === 'global' || tipo === 'todos') {
            // 1. Obtener Top Estudiantes
            const estudiantes = await RankingModel.obtenerRankingLectores({ ...options, tipo: 'estudiante', limit: limit + 5 }); // Pedir un poco más para el merge
            // 2. Obtener Top Docentes
            const docentes = await RankingModel.obtenerRankingLectores({ ...options, tipo: 'docente', limit: limit + 5 });

            // 3. Unificar format
            const unificados = [
                ...estudiantes.map(e => ({ ...e, tipoUsuario: 'Estudiante', infoAdicional: `${e.grado}° Grado` })),
                ...docentes.map(d => ({ ...d, tipoUsuario: 'Docente', infoAdicional: d.area_docente || 'Docente' }))
            ];

            // 4. Ordenar descendente por totalLibros
            unificados.sort((a, b) => b.totalLibros - a.totalLibros);

            // 5. Cortar al limite
            return unificados.slice(0, limit);
        }

        let whereClause = 'u.rol = ?';
        params.push(tipo);

        if (grado && grado !== 'todos' && tipo === 'estudiante') {
            whereClause += ' AND u.grado = ?';
            params.push(grado);
        }

        if (busqueda) {
            whereClause += ' AND u.nombre LIKE ?';
            params.push(`%${busqueda}%`);
        }

        // Construir subconsultas segun fechas para fisicos y virtuales
        let dateFilterFisico = '';
        let dateFilterVirtual = '';
        const dateParams = [];

        if (fechaInicio) {
            if (fechaFin) {
                dateFilterFisico = 'AND p.fecha_prestamo BETWEEN ? AND ?';
                dateFilterVirtual = 'AND lv.fecha_lectura BETWEEN ? AND ?';
                dateParams.push(fechaInicio, fechaFin);
            } else {
                dateFilterFisico = 'AND p.fecha_prestamo >= ?';
                dateFilterVirtual = 'AND lv.fecha_lectura >= ?';
                dateParams.push(fechaInicio);
            }
        }

        let query = '';

        if (tipo === 'docente') {
            // Logica Docente (Solo prestamos fisicos por ahora, fecha_prestamo)
            let dateFilterDocente = '';
            if (fechaInicio) {
                if (fechaFin) {
                    dateFilterDocente = 'AND p.fecha_prestamo BETWEEN ? AND ?';
                } else {
                    dateFilterDocente = 'AND p.fecha_prestamo >= ?';
                }
            }

            query = `
                SELECT 
                    u.id, 
                    u.nombre, 
                    "Docente" as grado,
                    "Docente" as area_docente,
                    COUNT(p.id) as totalLibros,
                    COUNT(DISTINCT l.area) as areasLeidas
                FROM usuarios u
                LEFT JOIN prestamos p ON p.usuario_id = u.id ${dateFilterDocente}
                LEFT JOIN libros l ON p.libro_id = l.id
                WHERE ${whereClause}
                GROUP BY u.id
                ORDER BY totalLibros DESC
                LIMIT ?
            `;
            // Re-inject params for docente logic because structure is different
            // Params so far: [rol, grado?, busqueda?]
            // We need to insert date params before LIMIT if they exist
            // Actually, simplest way is to rebuild params array for this branch
        } else {
            // Logica Estudiante (Fisicos + Virtuales)
            // Necesitamos params duplicados para las dos subconsultas de fecha

            // Subquery Fisicos (Coincidir con Profile: Solo devueltos, no requiere validacion docente estricta para ranking lectura)
            const subFisico = `
                (SELECT COUNT(*) FROM prestamos p 
                 WHERE p.usuario_id = u.id AND p.fecha_devolucion_real IS NOT NULL ${dateFilterFisico})
            `;

            // Subquery Virtuales (Coincidir con Profile: Cuenta todas)
            const subVirtual = `
                (SELECT COUNT(*) FROM lecturas_virtuales lv 
                 WHERE lv.usuario_id = u.id ${dateFilterVirtual})
            `;

            query = `
            SELECT
            u.id,
                u.nombre,
                u.grado,
                (${subFisico} + ${subVirtual}) as totalLibros,
                (SELECT COUNT(DISTINCT l.area) 
                     FROM prestamos p 
                     JOIN libros l ON p.libro_id = l.id 
                     WHERE p.usuario_id = u.id AND p.fecha_devolucion_real IS NOT NULL ${dateFilterFisico}) as areasLeidas
                FROM usuarios u
                WHERE ${whereClause}
                ORDER BY totalLibros DESC, u.nombre ASC
            LIMIT ?
                `;
        }

        // Final param assembly
        let finalParams = [];
        if (tipo === 'docente') {
            // Params order: [DateParams (for JOIN ON), Type, Search (for WHERE), Limit]
            const dateParamsDocente = [];
            if (fechaInicio) {
                dateParamsDocente.push(fechaInicio);
                if (fechaFin) dateParamsDocente.push(fechaFin);
            }

            const whereParamsDocente = [tipo];
            if (busqueda) whereParamsDocente.push(`%${busqueda}%`);

            finalParams = [...dateParamsDocente, ...whereParamsDocente, parseInt(limit)];
        } else {
            // Estudiante Params Order:
            // 1. Subquery Fisico Dates
            // 2. Subquery Virtual Dates
            // 3. Subquery Areas Dates
            // 4. Main WHERE (rol, grado, busqueda)
            // 5. LIMIT

            // Wait, params in subqueries need to be passed strictly.
            // Better strategy: Use formatted dates directly in string IF trusted, but better to use ? and flatMap params.

            // Let's restructure to be cleaner:
            const pFisico = [...dateParams];
            const pVirtual = [...dateParams];
            const pAreas = [...dateParams];
            const pMain = [tipo];
            if (grado && grado !== 'todos') pMain.push(grado);
            if (busqueda) pMain.push(`%${busqueda}%`);

            finalParams = [...pFisico, ...pVirtual, ...pAreas, ...pMain, parseInt(limit)];
        }

        const [rows] = await pool.query(query, finalParams);
        return rows;
    }

    /**
     * Retorna el total de libros leídos agrupados por grado.
     */
    static async obtenerLecturasPorGrado() {
        const [rows] = await pool.query(
            `SELECT u.grado, COUNT(p.id) as total_libros
             FROM prestamos p
             JOIN usuarios u ON p.usuario_id = u.id

             WHERE u.rol = 'estudiante' AND p.validado = 1
             GROUP BY u.grado
             ORDER BY u.grado ASC`
        );
        return rows;
    }
}

module.exports = RankingModel;
