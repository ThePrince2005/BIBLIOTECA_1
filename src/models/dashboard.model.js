const { pool } = require('../config/database');

const DashboardModel = {
  /**
   * Obtiene las estadísticas principales para el dashboard administrativo.
   * Ejecuta todas las consultas en paralelo para máxima eficiencia.
   */
  async getAdminStats(options = {}) {
    const connection = await pool.getConnection();
    const { startOfWeek, endOfWeek } = options;
    try {
      const [
        [basicStats],
        prestamosPorMes,
        prestamosSemana,
        librosMasPrestados,
        prestamosPorGrado,
        alertas,
        [totalEstudiantes],
        [estudiantesActivosHoy],
        librosPorAnio,
      ] = await Promise.all([
        // 1. Estadísticas Básicas
        connection.query(`
          SELECT
            (SELECT COUNT(*) FROM libros) as totalLibros,
            (SELECT COUNT(*) FROM prestamos) as totalPrestamos,
            (SELECT COUNT(*) FROM prestamos WHERE estado = 'activo') as prestamosActivos,
            (SELECT COUNT(*) FROM prestamos WHERE estado = 'pendiente') as prestamosPendientes,
            (SELECT COUNT(*) FROM prestamos WHERE estado = 'vencido') as prestamosVencidos,
            (SELECT COUNT(DISTINCT usuario_id) FROM prestamos 
             WHERE estado IN ('activo', 'vencido')) as estudiantesActivos,
            (SELECT COUNT(*) FROM prestamos 
             WHERE estado = 'activo' 
             AND fecha_devolucion_esperada < DATE_ADD(CURDATE(), INTERVAL 7 DAY)) as devolucionesPendientes,
            (SELECT COUNT(*) FROM prestamos WHERE fecha_prestamo = CURDATE()) as prestamosDiaActual,
            (SELECT COUNT(*) FROM prestamos WHERE estado IN ('devuelto', 'validado')) as totalFisicosLeidos,
            (SELECT COUNT(*) FROM lecturas_virtuales) as totalVirtualesLeidos
        `),

        // 2. Préstamos por Mes (Año Actual)
        connection.query(`
          SELECT DATE_FORMAT(fecha_prestamo, '%Y-%m') as mes, COUNT(*) as total 
          FROM prestamos 
          WHERE YEAR(fecha_prestamo) = YEAR(CURDATE()) 
          GROUP BY DATE_FORMAT(fecha_prestamo, '%Y-%m') 
          ORDER BY mes ASC
        `),

        // 3. Histórico Semanal
        connection.query(`
            SELECT 
                DATE(fecha_prestamo) as fecha,
                WEEKDAY(fecha_prestamo) as day_index,
                COUNT(*) as total
            FROM prestamos
            WHERE fecha_prestamo BETWEEN ? AND ?
            GROUP BY DATE(fecha_prestamo), WEEKDAY(fecha_prestamo)
        `, [startOfWeek, endOfWeek]),

        // 4. Libros más prestados (Top 10)
        connection.query(`
          SELECT 
            l.titulo, 
            l.autor,
            COUNT(*) as totalPrestamos,
            l.ejemplares_totales - (
              SELECT COUNT(*) 
              FROM prestamos 
              WHERE libro_id = l.id AND estado = 'activo'
            ) as disponibles
          FROM prestamos p 
          JOIN libros l ON p.libro_id = l.id 
          GROUP BY l.id, l.titulo, l.autor, l.ejemplares_totales
          ORDER BY totalPrestamos DESC 
          LIMIT 10
        `),

        // 5. Préstamos por Grado (Base para otras KPIs)
        connection.query(`
          SELECT 
            g.grado,
            COALESCE(d.total_estudiantes, 0) as total_estudiantes,
            COALESCE(d.activos, 0) as activos,
            COALESCE(d.vencidos, 0) as vencidos,
            COALESCE(d.devueltos, 0) as devueltos,
            COALESCE(d.total_historico, 0) as total_historico
          FROM 
            (SELECT 1 AS grado UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) g
          LEFT JOIN (
            SELECT 
              u.grado,
              COUNT(DISTINCT p.usuario_id) as total_estudiantes,
              SUM(CASE WHEN p.estado = 'activo' THEN 1 ELSE 0 END) as activos,
              SUM(CASE WHEN p.estado = 'vencido' THEN 1 ELSE 0 END) as vencidos,
              SUM(CASE WHEN p.estado = 'devuelto' THEN 1 ELSE 0 END) as devueltos,
              COUNT(*) as total_historico
            FROM prestamos p 
            JOIN usuarios u ON p.usuario_id = u.id 
            WHERE u.grado BETWEEN 1 AND 5
            GROUP BY u.grado
          ) d ON g.grado = d.grado
          ORDER BY g.grado ASC
        `),

        // 6. Alertas (Vencimientos y Pendientes Recientes)
        connection.query(`
          (SELECT 
              'VENCIMIENTO' as tipo,
              CONCAT('Préstamo vencido - ', l.titulo) as titulo,
              CONCAT(u.nombre, ' debe devolver ', l.titulo, ' (vencido hace ', 
                     DATEDIFF(CURDATE(), p.fecha_devolucion_esperada), ' días)') as mensaje,
              p.id as prestamo_id
           FROM prestamos p
           JOIN usuarios u ON p.usuario_id = u.id
           JOIN libros l ON p.libro_id = l.id
           WHERE p.estado = 'vencido'
           ORDER BY p.fecha_devolucion_esperada ASC
           LIMIT 5)
          UNION ALL
          (SELECT 
              'PENDIENTE' as tipo,
              CONCAT('Préstamo pendiente - ', l.titulo) as titulo,
              CONCAT(u.nombre, ' ha solicitado ', l.titulo, ' el ', 
                     DATE_FORMAT(p.fecha_prestamo, '%d/%m/%Y')) as mensaje,
              p.id as prestamo_id
           FROM prestamos p
           JOIN usuarios u ON p.usuario_id = u.id
           JOIN libros l ON p.libro_id = l.id
           WHERE p.estado = 'pendiente'
           ORDER BY p.fecha_prestamo DESC
           LIMIT 5)
        `),

        // 7. Stats Estudiantes (Total y Activos Hoy)
        connection.query(`SELECT COUNT(*) as total FROM usuarios WHERE rol = 'estudiante'`),
        connection.query(`
             SELECT COUNT(DISTINCT usuario_id) as activos_hoy
              FROM prestamos
              WHERE fecha_prestamo = CURDATE()
        `),

        // 8. KPI 1: Libros por año (últimos 5 años)
        connection.query(`
          SELECT YEAR(fecha_prestamo) as anio, COUNT(*) as total
          FROM prestamos
          WHERE fecha_prestamo >= DATE_SUB(CURDATE(), INTERVAL 5 YEAR)
          GROUP BY YEAR(fecha_prestamo)
          ORDER BY anio ASC
        `)
      ]);

      // --- PROCESAMIENTO DE DATOS EN MEMORIA ---

      const librosPopulares = librosMasPrestados[0].map((l) => ({
        titulo: l.titulo,
        prestamos: l.totalPrestamos,
      }));

      // Derivar 'rankingGrados' desde 'prestamosPorGrado'
      // rankingGrados espera: [{grado: 1, total_libros: N}, ...] donde total_libros = devueltos
      const rankingGradosDerived = prestamosPorGrado[0].map(row => ({
        grado: row.grado,
        total_libros: parseInt(row.devueltos) || 0
      }));

      // Derivar 'comparativaGrados' desde 'prestamosPorGrado' (Solo grados 1 y 5)
      // comparativaGrados espera: [{grado: 1, total_libros: N}, {grado: 5, total_libros: N}]
      const comparativaGradosDerived = prestamosPorGrado[0]
        .filter(row => row.grado === 1 || row.grado === 5)
        .map(row => ({
          grado: row.grado,
          total_libros: parseInt(row.devueltos) || 0
        }));

      // Top Lectores via Modelo
      const startOfYear = new Date(new Date().getFullYear(), 0, 1);
      const endOfYear = new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999);

      const topLectores = await require('./ranking.model').obtenerRankingLectores({
        limit: 10,
        periodo: 'anio_actual',
        tipo: 'estudiante',
        fechaInicio: startOfYear,
        fechaFin: endOfYear
      });

      const topDocentes = await require('./ranking.model').obtenerRankingLectores({
        limit: 10,
        periodo: 'anio_actual',
        tipo: 'docente',
        fechaInicio: startOfYear,
        fechaFin: endOfYear
      });

      return {
        totalLibros: basicStats[0].totalLibros,
        totalPrestamos: basicStats[0].totalPrestamos,
        prestamosActivos: basicStats[0].prestamosActivos,
        prestamosPendientes: basicStats[0].prestamosPendientes,
        prestamosVencidos: basicStats[0].prestamosVencidos,
        estudiantesActivos: basicStats[0].estudiantesActivos,
        devolucionesPendientes: basicStats[0].devolucionesPendientes,
        prestamosDiaActual: basicStats[0].prestamosDiaActual,
        totalFisicosLeidos: basicStats[0].totalFisicosLeidos,
        totalVirtualesLeidos: basicStats[0].totalVirtualesLeidos,
        totalEstudiantes: totalEstudiantes[0].total,
        estudiantesActivosHoy: estudiantesActivosHoy[0].activos_hoy,
        prestamosPorMes: prestamosPorMes[0],
        prestamosSemana: prestamosSemana[0],
        librosMasPrestados: librosMasPrestados[0],
        prestamosPorGrado: prestamosPorGrado[0],
        librosPopulares,
        topLectores: topLectores,
        topDocentes: topDocentes,
        alertas: alertas[0],
        librosPorAnio: librosPorAnio[0],
        comparativaGrados: comparativaGradosDerived,
        rankingGrados: rankingGradosDerived,
      };
    } finally {
      connection.release();
    }
  },

  /**
   * Obtiene estadísticas globales para el dashboard docente.
   * Muestra tendencias generales y de estudiantes.
   */
  async getDocenteStats() {
    const connection = await pool.getConnection();
    try {
      const [
        librosMasPrestados,
        librosPorAnio,
        rankingGrados
      ] = await Promise.all([
        // 1. Libros más prestados (Global)
        connection.query(`
            SELECT 
              l.titulo, 
              COUNT(*) as totalPrestamos
            FROM prestamos p 
            JOIN libros l ON p.libro_id = l.id 
            WHERE YEAR(p.fecha_prestamo) = YEAR(CURDATE())
            GROUP BY l.id, l.titulo
            ORDER BY totalPrestamos DESC 
            LIMIT 10
          `),

        // 2. Préstamos por mes (Global - Año Actual)
        connection.query(`
            SELECT DATE_FORMAT(fecha_prestamo, '%Y-%m') as mes, COUNT(*) as total
            FROM prestamos
            WHERE YEAR(fecha_prestamo) = YEAR(CURDATE())
            GROUP BY DATE_FORMAT(fecha_prestamo, '%Y-%m')
            ORDER BY mes ASC
          `),

        // 3. Ranking de lectura por grados (Año Actual)
        connection.query(`
            SELECT 
              g.grado,
              COALESCE(SUM(CASE WHEN p.id IS NOT NULL THEN 1 ELSE 0 END), 0) as total_libros
            FROM 
              (SELECT 1 AS grado UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) g
            LEFT JOIN usuarios u ON u.grado = g.grado AND u.rol = 'estudiante'
            LEFT JOIN prestamos p ON p.usuario_id = u.id 
              AND p.estado = 'devuelto' 
              AND YEAR(p.fecha_prestamo) = YEAR(CURDATE())
            GROUP BY g.grado
            ORDER BY g.grado ASC
          `)
      ]);

      return {
        librosMasPrestados: librosMasPrestados[0].map(l => ({ titulo: l.titulo, totalPrestamos: l.totalPrestamos })),
        librosPorAnio: librosPorAnio[0],
        rankingGrados: rankingGrados[0]
      };

    } catch (error) {
      console.error('Error al obtener estadísticas docente:', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  },

  /**
   * Obtiene las estadísticas para el dashboard de un estudiante específico.
   */
  async getEstudianteStats(usuarioId) {
    const connection = await pool.getConnection();
    try {
      const [
        [basicStats],
        historicoMensual,
        categorias,
        autores,
        proximasDevoluciones,
        totalLeidosRow, // fisico
        totalVirtualesRow, // virtual
        recomendados,
        lecturasVirtualesMensual,
      ] = await Promise.all([
        connection.query(
          `
            SELECT
              (SELECT COUNT(*) FROM prestamos WHERE usuario_id = ? AND estado IN ('activo', 'vencido')) as prestamosActivos,
              (SELECT COUNT(*) FROM prestamos WHERE usuario_id = ? AND YEAR(fecha_prestamo) = YEAR(CURDATE())) as totalPrestamos,
              (SELECT COUNT(*) FROM favoritos WHERE usuario_id = ?) as librosFavoritos
          `,
          [usuarioId, usuarioId, usuarioId]
        ),

        connection.query(
          `
            SELECT DATE_FORMAT(fecha_prestamo, '%Y-%m') as mes, COUNT(*) as total 
            FROM prestamos
            WHERE usuario_id = ? 
              AND YEAR(fecha_prestamo) = YEAR(CURDATE())
            GROUP BY DATE_FORMAT(fecha_prestamo, '%Y-%m') 
            ORDER BY mes ASC
          `,
          [usuarioId]
        ),

        connection.query(
          `
            SELECT area as nombre, COUNT(*) as total FROM (
                SELECT l.area FROM prestamos p 
                JOIN libros l ON p.libro_id = l.id 
                WHERE p.usuario_id = ? AND YEAR(p.fecha_prestamo) = YEAR(CURDATE())
                UNION ALL
                SELECT l.categoria as area FROM lecturas_virtuales lv 
                JOIN libros_virtuales l ON lv.libro_virtual_id = l.id 
                WHERE lv.usuario_id = ? AND YEAR(lv.fecha_lectura) = YEAR(CURDATE())
            ) as combined
            GROUP BY area 
            ORDER BY total DESC 
            LIMIT 5
          `,
          [usuarioId, usuarioId]
        ),

        connection.query(
          `
            SELECT autor as nombre, COUNT(*) as total FROM (
                SELECT l.autor FROM prestamos p 
                JOIN libros l ON p.libro_id = l.id 
                WHERE p.usuario_id = ? AND YEAR(p.fecha_prestamo) = YEAR(CURDATE())
                UNION ALL
                SELECT l.autor FROM lecturas_virtuales lv 
                JOIN libros_virtuales l ON lv.libro_virtual_id = l.id 
                WHERE lv.usuario_id = ? AND YEAR(lv.fecha_lectura) = YEAR(CURDATE())
            ) as combined
            GROUP BY autor 
            ORDER BY total DESC 
            LIMIT 5
          `,
          [usuarioId, usuarioId]
        ),

        connection.query(
          `
            SELECT 
              p.id, 
              l.titulo, 
              l.autor, 
              p.fecha_devolucion_esperada, 
              p.fecha_prestamo, 
              p.estado 
            FROM prestamos p
            JOIN libros l ON p.libro_id = l.id 
            WHERE p.usuario_id = ? 
              AND p.estado IN ('activo', 'vencido')
            ORDER BY p.fecha_devolucion_esperada ASC
          `,
          [usuarioId]
        ),

        // Total físicos leídos (coincidir con perfil: fecha_devolucion_real IS NOT NULL)
        connection.query(
          `
              SELECT COUNT(*) as totalLeidos 
              FROM prestamos 
              WHERE usuario_id = ? 
                AND fecha_devolucion_real IS NOT NULL
            `,
          [usuarioId]
        ),

        // Total virtuales leídos (histórico completo)
        connection.query(
          `
              SELECT COUNT(*) as totalVirtuales
              FROM lecturas_virtuales
              WHERE usuario_id = ?
              `,
          [usuarioId]
        ),

        connection.query(
          `
            SELECT 
              l.id, 
              l.titulo, 
              l.autor, 
              l.area, 
              '/images/default-book.png' as portada_url,
              (l.ejemplares_totales - (SELECT COUNT(*) FROM prestamos WHERE libro_id = l.id AND estado = 'activo')) as disponibles
            FROM libros l
            LEFT JOIN prestamos p ON l.id = p.libro_id
            GROUP BY l.id
            HAVING disponibles > 0
            ORDER BY COUNT(p.id) DESC
            LIMIT 3
          `
        ),

        // Histórico mensual de lecturas virtuales
        connection.query(
          `
            SELECT DATE_FORMAT(fecha_lectura, '%Y-%m') AS mes, COUNT(*) AS total
            FROM lecturas_virtuales
            WHERE usuario_id = ?
              AND YEAR(fecha_lectura) = YEAR(CURDATE())
            GROUP BY DATE_FORMAT(fecha_lectura, '%Y-%m')
            ORDER BY mes ASC
          `,
          [usuarioId]
        ),
      ]);

      // Combinar histórico mensual: préstamos + virtuales
      const mapaMeses = new Map();

      historicoMensual[0].forEach((h) => {
        mapaMeses.set(h.mes, (mapaMeses.get(h.mes) || 0) + h.total);
      });

      lecturasVirtualesMensual[0].forEach((v) => {
        mapaMeses.set(v.mes, (mapaMeses.get(v.mes) || 0) + v.total);
      });

      const historicoCombinado = Array.from(mapaMeses.entries())
        .map(([mes, total]) => ({ mes, total }))
        .sort((a, b) => (a.mes > b.mes ? 1 : -1));

      const totalFisicos = totalLeidosRow[0][0]
        ? totalLeidosRow[0][0].totalLeidos
        : 0;

      const totalVirtuales = totalVirtualesRow[0][0]
        ? totalVirtualesRow[0][0].totalVirtuales
        : 0;

      const totalLeidos = totalFisicos + totalVirtuales;

      const umbrales = [5, 20, 50];
      let siguiente =
        umbrales.find((u) => totalLeidos < u) ||
        umbrales[umbrales.length - 1];
      if (totalLeidos >= umbrales[umbrales.length - 1]) {
        siguiente = umbrales[umbrales.length - 1];
      }
      const porcentaje =
        siguiente > 0
          ? Math.min(100, Math.round((totalLeidos / siguiente) * 100))
          : 100;

      // --- PROCESAMIENTO DE CATEGORÍAS (Traducción y Limpieza) ---
      const categoriasTraducidas = (categorias[0] || []).map(c => {
        let nombre = c.nombre || 'Sin Categoría';

        // Limpieza: Si es "Mathematics / Algebra", quedarse con "Mathematics"
        if (nombre.includes('/')) {
          nombre = nombre.split('/')[0].trim();
        }

        // Traducciones comunes
        const diccionario = {
          'Mathematics': 'Matemáticas',
          'Science': 'Ciencia',
          'History': 'Historia',
          'Social Science': 'Ciencias Sociales',
          'Fiction': 'Ficción',
          'Computers': 'Computación',
          'Technology': 'Tecnología',
          'Business & Economics': 'Negocios',
          'Juvenile Nonfiction': 'Juvenil - No Ficc.',
          'Juvenile Fiction': 'Infantil / Juvenil',
          'Biography & Autobiography': 'Biografía',
          'Medical': 'Medicina',
          'Psychology': 'Psicología',
          'Philosophy': 'Filosofía',
          'Political Science': 'Ciencia Política',
          'Religion': 'Religión',
          'Art': 'Arte',
          'Health & Fitness': 'Salud',
          'Language Arts & Disciplines': 'Lenguas',
          'Law': 'Derecho',
          'Education': 'Educación',
          'Literary Criticism': 'Crítica Literaria',
          'Performing Arts': 'Artes Escénicas'
        };

        return {
          nombre: diccionario[nombre] || nombre,
          total: c.total
        };
      });

      // Re-agrupar si después de traducir hay duplicados (ej: "Math / A" y "Math / B" -> ambos "Matemáticas")
      const categoriasAgrupadas = categoriasTraducidas.reduce((acc, curr) => {
        const existing = acc.find(item => item.nombre === curr.nombre);
        if (existing) {
          existing.total += curr.total;
        } else {
          acc.push({ nombre: curr.nombre, total: curr.total });
        }
        return acc;
      }, []);

      // Re-ordenar por total DESC y limitar a 5
      categoriasAgrupadas.sort((a, b) => b.total - a.total);
      const top5Categorias = categoriasAgrupadas.slice(0, 5);

      return {
        ...basicStats[0],
        historicoMensual: historicoCombinado,
        categorias: top5Categorias,
        autores: autores[0],
        totalLeidos,
        progreso: { total: totalLeidos, siguiente, porcentaje },
        proximasDevoluciones: proximasDevoluciones[0],
        recomendados: recomendados[0],
      };
    } finally {
      connection.release();
    }
  },

  /**
   * Obtiene estadísticas de préstamos por grado con filtro de fechas opcional.
   */
  async obtenerEstadisticasPorGrado(filtros = {}) {
    const connection = await pool.getConnection();
    try {
      let dateFilter = '';
      const params = [];

      if (filtros.fechaInicio && filtros.fechaFin) {
        dateFilter = 'AND p.fecha_prestamo BETWEEN ? AND ?';
        params.push(filtros.fechaInicio, filtros.fechaFin);
      } else if (filtros.fechaInicio) {
        dateFilter = 'AND p.fecha_prestamo >= ?';
        params.push(filtros.fechaInicio);
      }

      const [rows] = await connection.query(`
        SELECT 
            g.grado,
            COALESCE(d.activos, 0) as activos,
            COALESCE(d.vencidos, 0) as vencidos,
            COALESCE(d.devueltos, 0) as devueltos,
            COALESCE(d.total, 0) as total_historico
        FROM 
            (SELECT 1 AS grado UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5) g
        LEFT JOIN (
            SELECT 
                u.grado,
                SUM(CASE WHEN p.estado = 'activo' THEN 1 ELSE 0 END) as activos,
                SUM(CASE WHEN p.estado = 'vencido' THEN 1 ELSE 0 END) as vencidos,
                SUM(CASE WHEN p.estado = 'devuelto' THEN 1 ELSE 0 END) as devueltos,
                COUNT(*) as total
            FROM prestamos p 
            JOIN usuarios u ON p.usuario_id = u.id 
            WHERE u.rol = 'estudiante' ${dateFilter}
            GROUP BY u.grado
        ) d ON g.grado = d.grado
        ORDER BY g.grado ASC
      `, params);

      return rows;
    } finally {
      connection.release();
    }
  },

  /**
   * Obtiene la lista de próximas devoluciones (préstamos activos/vencidos) para un usuario.
   * Reutilizable para estudiantes y docentes.
   */
  async getProximasDevoluciones(usuarioId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(
        `
            SELECT 
              p.id, 
              l.titulo, 
              l.autor, 
              p.fecha_devolucion_esperada, 
              p.fecha_prestamo, 
              p.estado 
            FROM prestamos p
            JOIN libros l ON p.libro_id = l.id 
            WHERE p.usuario_id = ? 
              AND p.estado IN ('activo', 'vencido')
            ORDER BY p.fecha_devolucion_esperada ASC
          `,
        [usuarioId]
      );
      return rows;
    } finally {
      connection.release();
    }
  },

  /**
   * Obtiene la actividad de los últimos 7 días para un usuario (gráfico lineal).
   */
  async getActividadReciente(usuarioId) {
    const connection = await pool.getConnection();
    try {
      const [rows] = await connection.query(`
         SELECT 
           DATE(fecha_prestamo) as fecha, 
           COUNT(*) as total 
         FROM prestamos 
         WHERE usuario_id = ? 
           AND fecha_prestamo >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY DATE(fecha_prestamo)
         ORDER BY fecha ASC
       `, [usuarioId]);
      return rows;
    } finally {
      connection.release();
    }
  },
};

module.exports = DashboardModel;
