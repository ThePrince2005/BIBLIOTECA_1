const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

class Usuario {
    /**
     * Crear un nuevo usuario
     * @param {Object} userData - Datos del usuario
     * @returns {Promise} Resultado de la creación
     */
    static async crear(userData) {
        let connection;
        try {
            connection = await pool.getConnection();
            console.log('Iniciando creación de usuario:', {
                ...userData,
                contrasena: '[OCULTA]'
            });

            // Contraseña ya debe venir hasheada desde el controlador
            const hashedPassword = userData.contrasena;

            // Construir la consulta SQL
            const query = `INSERT INTO usuarios (nombre, correo, contrasena, rol, grado, seccion, activo) 
                          VALUES (?, ?, ?, ?, ?, ?, 1)`; // Nuevo usuario por defecto activo = 1

            // Validar y transformar datos
            const values = [
                userData.nombre.trim(),
                userData.correo.trim().toLowerCase(),
                hashedPassword,
                userData.rol,
                userData.grado !== undefined && userData.grado !== null && userData.grado !== '' ? parseInt(userData.grado) : null,
                userData.seccion !== undefined && userData.seccion !== null && userData.seccion !== '' ? userData.seccion.trim().toUpperCase() : null
            ];

            // Validar tipos de datos si es estudiante
            if (userData.rol === 'estudiante') {
                if (values[4] !== null && (isNaN(values[4]) || values[4] < 1 || values[4] > 12)) { // Asumiendo grados de 1 a 12
                    throw new Error('El grado debe ser un número entre 1 y 12');
                }
            }


            console.log('Ejecutando consulta SQL:', {
                query,
                values: values.map(v => v === null ? 'NULL' : v)
            });

            const [result] = await connection.execute(query, values);
            console.log('Usuario creado exitosamente. ID:', result.insertId);

            return result.insertId;
        } catch (error) {
            console.error('Error al crear usuario:', error);
            throw new Error(`Error al crear usuario: ${error.message}`);
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Crear múltiples usuarios en una sola transacción (Batch Insert)
     * @param {Array<Object>} usersData - Array de objetos de usuario
     * @returns {Promise<Object>} Resultado de la creación (nro de filas afectadas)
     */
    static async crearBatch(usersData) {
        let connection;
        try {
            connection = await pool.getConnection();
            if (!usersData || usersData.length === 0) return { affectedRows: 0 };

            // Construir la consulta
            // INSERT INTO usuarios (nombre, correo, contrasena, rol, grado, seccion, dni, activo) VALUES ?
            // mysql2 soporta bulk insert pasando un array de arrays como valores

            const query = `
                INSERT INTO usuarios (nombre, apellido, correo, contrasena, rol, grado, seccion, dni, activo) 
                VALUES ?
            `;

            const values = usersData.map(u => [
                u.nombre,
                u.apellido || '', // Asegurar campo apellido
                u.correo,
                u.contrasena,
                u.rol,
                u.grado,
                u.seccion,
                u.dni,
                1 // activo
            ]);

            const [result] = await connection.query(query, [values]);

            return result;
        } catch (error) {
            console.error('Error en crearBatch:', error);
            throw error;
        } finally {
            if (connection) connection.release();
        }
    }

    /**
     * Buscar usuario por correo
     * @param {string} correo - Correo del usuario
     * @returns {Promise} Usuario encontrado
     */
    static async buscarPorCorreo(correo) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM usuarios WHERE correo = ?',
                [correo]
            );
            return rows[0];
        } finally {
            connection.release();
        }
    }

    /**
     * Buscar usuario por DNI
     * @param {string} dni - DNI del usuario
     * @returns {Promise} Usuario encontrado
     */
    static async buscarPorDNI(dni) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM usuarios WHERE dni = ?',
                [dni]
            );
            return rows[0];
        } finally {
            connection.release();
        }
    }

    /**
     * Buscar usuario por ID
     * @param {number} id - ID del usuario
     * @returns {Promise} Usuario encontrado
     */
    static async findById(id) {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT * FROM usuarios WHERE id = ?',
                [id]
            );
            return rows[0];
        } finally {
            connection.release();
        }
    }

    /**
     * Actualizar datos del usuario
     * @param {number} id - ID del usuario
     * @param {Object} userData - Datos a actualizar
     * @returns {Promise} Resultado de la actualización
     */
    static async actualizar(id, userData) {
        const connection = await pool.getConnection();
        try {
            const actualizables = ['nombre', 'grado', 'seccion', 'area_docente', 'foto_url'];
            const updates = [];
            const values = [];

            actualizables.forEach(campo => {
                if (userData[campo] !== undefined) {
                    updates.push(`${campo} = ?`);
                    values.push(userData[campo]);
                }
            });

            if (userData.contrasena) {
                const salt = await bcrypt.genSalt(10);
                const hashedPassword = await bcrypt.hash(userData.contrasena, salt);
                updates.push('contrasena = ?');
                values.push(hashedPassword);
            }

            values.push(id);

            const [result] = await connection.execute(
                `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            return result.affectedRows > 0;
        } finally {
            connection.release();
        }
    }

    /**
     * Actualizar datos del usuario por ID
     * @param {number} id - ID del usuario
     * @param {Object} userData - Datos a actualizar
     * @returns {Promise} Resultado de la actualización
     */
    static async updateById(id, userData) {
        return this.actualizar(id, userData);
    }

    /**
     * Verificar contraseña
     * @param {string} password - Contraseña a verificar
     * @param {string} hashedPassword - Contraseña hasheada almacenada
     * @returns {Promise<boolean>} Resultado de la verificación
     */
    static async verificarContrasena(password, hashedPassword) {
        return await bcrypt.compare(password, hashedPassword);
    }

    /**
     * Obtener total de estudiantes activos
     * @returns {Promise<number>} Número de estudiantes activos
     */
    static async obtenerTotalEstudiantesActivos() {
        const connection = await pool.getConnection();
        try {
            const [rows] = await connection.execute(
                'SELECT COUNT(*) as total FROM usuarios WHERE rol = "estudiante" AND activo = 1'
            );
            return rows[0].total;
        } finally {
            connection.release();
        }
    }

    /**
     * Obtener estadísticas del estudiante
     * @param {number} id - ID del usuario estudiante
     * @returns {Promise<Object>} Estadísticas del estudiante
     */
    static async obtenerEstadisticasEstudiante(id) {
        const connection = await pool.getConnection();
        try {
            // Obtener total de libros leídos: SOLO DEVUELTOS (según corrección del usuario)
            const [leidosFisicos] = await connection.query(
                `SELECT COUNT(*) as total FROM prestamos 
             WHERE usuario_id = ? AND fecha_devolucion_real IS NOT NULL`,
                [id]
            );

            // Obtener total de libros virtuales leídos (todos, para consistencia)
            const [leidosVirtuales] = await connection.query(
                `SELECT COUNT(*) as total FROM lecturas_virtuales 
             WHERE usuario_id = ?`,
                [id]
            );

            const totalLeidos = leidosFisicos[0].total + leidosVirtuales[0].total;

            // Obtener préstamos activos (usar la columna fecha_devolucion_esperada)
            const [activos] = await connection.execute(
                `SELECT COUNT(*) as total FROM prestamos 
             WHERE usuario_id = ? AND fecha_devolucion_real IS NULL 
             AND fecha_devolucion_esperada > CURRENT_DATE()`,
                [id]
            );

            // Obtener total de reseñas
            const [resenas] = await connection.execute(
                `SELECT COUNT(*) as total FROM resenas WHERE usuario_id = ?`,
                [id]
            );

            return {
                totalLeidos: totalLeidos,
                prestamosActivos: activos[0].total,
                resenas: resenas[0].total,
                nivel: Math.floor(totalLeidos / 5) + 1,
                progreso: (totalLeidos % 5) * 20
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Obtener estadísticas del docente/admin
     * @param {number} id - ID del usuario docente/admin
     * @returns {Promise<Object>} Estadísticas del docente/admin
     */
    static async obtenerEstadisticasDocente(id) {
        const connection = await pool.getConnection();
        try {
            // Obtener total de libros (ya que no hay columna creado_por)
            let librosTotal = 0;
            try {
                const [libros] = await connection.execute(
                    `SELECT COUNT(*) as total FROM libros`
                );
                librosTotal = libros[0].total;
            } catch (e) {
                console.warn('Error al contar libros:', e.message);
                librosTotal = 0;
            }

            // Obtener total de préstamos (sin filtrar por aprobado_por que no existe)
            let prestamosTotal = 0;
            try {
                const [prestamos] = await connection.execute(
                    `SELECT COUNT(*) as total FROM prestamos`
                );
                prestamosTotal = prestamos[0].total;
            } catch (e) {
                console.warn('Error al contar préstamos:', e.message);
                prestamosTotal = 0;
            }

            // Obtener total de estudiantes (sin filtro de activo que no existe en la tabla)
            const [estudiantes] = await connection.execute(
                'SELECT COUNT(*) as total FROM usuarios WHERE rol = "estudiante"'
            );

            // ===== ESTADÍSTICAS ESPECÍFICAS DEL DOCENTE =====
            // Libros físicos leídos (préstamos aceptados o devueltos por el docente)
            // Un préstamo se considera "leído" cuando:
            // 1. Está activo (aceptado) - el docente ya tiene el libro y puede leerlo
            // 2. Fue devuelto - el docente ya leyó el libro
            // Usamos DISTINCT para evitar contar el mismo préstamo dos veces si está activo y luego devuelto
            const [librosFisicosRow] = await connection.execute(
                `SELECT COUNT(DISTINCT id) as total 
                 FROM prestamos 
                 WHERE usuario_id = ? AND (estado = 'devuelto' OR fecha_devolucion_real IS NOT NULL)`,
                [id]
            );
            const librosFisicos = librosFisicosRow[0]?.total || 0;

            // Libros virtuales leídos por el docente
            const [librosVirtualesRow] = await connection.execute(
                `SELECT COUNT(DISTINCT lv.libro_virtual_id) as total
                 FROM lecturas_virtuales lv
                 WHERE lv.usuario_id = ?`,
                [id]
            );
            const librosVirtuales = librosVirtualesRow[0]?.total || 0;

            // Total de lecturas (físicas + virtuales)
            const totalLecturasDocente = librosFisicos + librosVirtuales;

            // Préstamos activos del docente
            const [prestamosActivosRow] = await connection.execute(
                `SELECT COUNT(*) as total 
                 FROM prestamos 
                 WHERE usuario_id = ? AND estado IN ('activo', 'vencido')`,
                [id]
            );
            const prestamosActivos = prestamosActivosRow[0]?.total || 0;

            // Libros favoritos del docente
            const [favoritosRow] = await connection.execute(
                `SELECT COUNT(*) as total 
                 FROM favoritos 
                 WHERE usuario_id = ?`,
                [id]
            );
            const librosFavoritos = favoritosRow[0]?.total || 0;

            // Reseñas publicadas por el docente
            // Nota: La tabla resenas no tiene columna 'estado', se cuentan todas las reseñas
            const [resenasRow] = await connection.execute(
                `SELECT COUNT(*) as total 
                 FROM resenas 
                 WHERE usuario_id = ?`,
                [id]
            );
            const resenasPublicadas = resenasRow[0]?.total || 0;

            // Obtener estadísticas de progreso de lectura diario (últimos 7 días)
            const [progresoDiario] = await connection.execute(`
                SELECT 
                    DATE(p.fecha_prestamo) as fecha,
                    DAYNAME(p.fecha_prestamo) as dia_nombre,
                    COUNT(DISTINCT p.id) as total_prestamos
                FROM prestamos p
                WHERE p.usuario_id = ? 
                  AND p.fecha_prestamo >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
                GROUP BY DATE(p.fecha_prestamo), DAYNAME(p.fecha_prestamo)
                ORDER BY fecha ASC
            `, [id]);

            // Procesar datos para el gráfico de días
            const diasSemana = [];
            const prestamosPorDia = [];
            const metas = []; // Meta diaria simbólica
            const metaDiaria = 1;

            // Generar los últimos 7 días
            const hoy = new Date();
            const diasES = {
                'Monday': 'Lunes', 'Tuesday': 'Martes', 'Wednesday': 'Miércoles',
                'Thursday': 'Jueves', 'Friday': 'Viernes', 'Saturday': 'Sábado', 'Sunday': 'Domingo'
            };

            for (let i = 6; i >= 0; i--) {
                const fecha = new Date();
                fecha.setDate(hoy.getDate() - i);

                // Nombre del día en español
                const nombreIngles = fecha.toLocaleDateString('en-US', { weekday: 'long' });
                const nombreDia = diasES[nombreIngles] || nombreIngles;

                diasSemana.push(nombreDia);

                // Formato YYYY-MM-DD local
                const year = fecha.getFullYear();
                const month = String(fecha.getMonth() + 1).padStart(2, '0');
                const day = String(fecha.getDate()).padStart(2, '0');
                const fechaLocal = `${year}-${month}-${day}`;

                // Buscar datos
                const datosDia = progresoDiario.find(item => {
                    let itemFechaStr;
                    if (item.fecha instanceof Date) {
                        const iYear = item.fecha.getFullYear();
                        const iMonth = String(item.fecha.getMonth() + 1).padStart(2, '0');
                        const iDay = String(item.fecha.getDate()).padStart(2, '0');
                        itemFechaStr = `${iYear}-${iMonth}-${iDay}`;
                    } else {
                        // Si viene como string 'YYYY-MM-DD'
                        itemFechaStr = String(item.fecha).split('T')[0];
                    }
                    return itemFechaStr === fechaLocal;
                });

                prestamosPorDia.push(datosDia ? datosDia.total_prestamos : 0);
                metas.push(metaDiaria);
            }

            return {
                librosAgregados: librosTotal,
                prestamosSupervisados: prestamosTotal,
                estudiantesActivos: estudiantes[0].total,
                // Estadísticas específicas del docente
                librosFisicos: librosFisicos,
                librosVirtuales: librosVirtuales,
                totalLecturasDocente: totalLecturasDocente,
                prestamosActivos: prestamosActivos,
                librosFavoritos: librosFavoritos,
                resenasPublicadas: resenasPublicadas,
                progresoLectura: {
                    meses: diasSemana, // Reutilizamos la clave 'meses' para no romper el frontend
                    prestamos: prestamosPorDia,
                    metas: metas,
                    metaActual: metaDiaria,
                    totalEstudiantes: estudiantes[0].total,
                    totalLibros: librosTotal
                }
            };
        } finally {
            connection.release();
        }
    }

    /**
     * Obtener lista de estudiantes con filtros opcionales
     * @param {Object} filtros - Filtros de búsqueda (grado, seccion, estado)
     * @returns {Promise<Array>} Lista de estudiantes
     */
    static async obtenerEstudiantes(filtros = {}) {
        const connection = await pool.getConnection();
        try {
            let query = `
                SELECT id, nombre, correo, dni, grado, seccion, 
                       activo
                FROM usuarios 
                WHERE rol = 'estudiante'
            `;
            const params = [];

            if (filtros.grado) {
                query += ' AND grado = ?';
                params.push(filtros.grado);
            }

            if (filtros.seccion) {
                query += ' AND seccion = ?';
                params.push(filtros.seccion);
            }

            // Ordenar por grado y sección, luego por nombre
            query += ' ORDER BY grado, seccion, nombre';

            const [rows] = await connection.execute(query, params);
            return rows;
        } finally {
            connection.release();
        }
    }
}

module.exports = Usuario;