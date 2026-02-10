const DashboardModel = require('../models/dashboard.model');
const Prestamo = require('../models/prestamo.model');
const Usuario = require('../models/usuario.model');
const RankingModel = require('../models/ranking.model'); // ya lo usabas en getTopLectoresAPI

const DashboardController = {
    // Promover estudiantes de año
    async promoverEstudiantes(req, res) {
        try {
            const resultado = await Usuario.promoverAnioEscolar();
            res.json({
                success: true,
                message: resultado.mensaje,
                data: resultado
            });
        } catch (error) {
            console.error('Error al promover estudiantes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al realizar la promoción escolar. Por favor intente nuevamente.'
            });
        }
    },

    // Dashboard administrativo (solo admin)
    async getAdminStats(req, res, next) {
        try {
            // Calcular rango de la semana (Lunes a Domingo) estrictamente
            const curr = new Date(); // Fecha actual del servidor
            const day = curr.getDay() || 7; // Convertir Domingo (0) a 7 para facilitar resta

            const startOfWeek = new Date(curr);
            startOfWeek.setDate(curr.getDate() - (day - 1)); // Ir al Lunes
            startOfWeek.setHours(0, 0, 0, 0); // Inicio del día

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 4); // Ir al Viernes (Lunes + 4)
            endOfWeek.setHours(23, 59, 59, 999); // Fin del día

            // Helper to format as 'YYYY-MM-DD HH:mm:ss' to avoid Timezone issues
            const pad = (n) => n < 10 ? '0' + n : n;
            const formatDateSQL = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

            const startStr = formatDateSQL(startOfWeek);
            const endStr = formatDateSQL(endOfWeek);

            console.log('--- DASHBOARD DEBUG ---');
            console.log(`Range: ${startStr} to ${endStr}`);

            const optionsDate = { day: '2-digit', month: '2-digit' };
            const rangoSemanaLabel = `${startOfWeek.toLocaleDateString('es-PE', optionsDate)} - ${endOfWeek.toLocaleDateString('es-PE', optionsDate)}`;

            // Pasar fechas explícitas al modelo (usando strings)
            const stats = await DashboardModel.getAdminStats({ startOfWeek: startStr, endOfWeek: endStr });
            stats.rangoSemana = rangoSemanaLabel;

            // ... init arrays ...
            stats.librosMasPrestados = stats.librosMasPrestados || { labels: [], data: [] };
            stats.prestamosPorGrado = stats.prestamosPorGrado || { labels: [], activos: [], vencidos: [] };
            stats.porGrado = stats.porGrado || { labels: [], data: [] };
            stats.librosPopulares = stats.librosPopulares || [];

            stats.librosPorAnio = stats.librosPorAnio || { labels: [], data: [] };
            stats.comparativaGrados = stats.comparativaGrados || { labels: [], data: [] };
            stats.rankingGrados = stats.rankingGrados || { labels: [], data: [] };
            stats.topLectores = stats.topLectores || [];

            // ... month logic ...
            // Histórico mensual préstamos (Correct mapping to 12 months)
            if (Array.isArray(stats.prestamosPorMes)) {
                const monthsData = new Array(12).fill(0);
                stats.prestamosPorMes.forEach(p => {
                    // p.mes is 'YYYY-MM'
                    const [year, month] = p.mes.split('-');
                    const index = parseInt(month, 10) - 1; // 0-based index (Jan=0)
                    if (index >= 0 && index < 12) {
                        monthsData[index] = p.total;
                    }
                });

                stats.prestamosPorMes = {
                    labels: [], // Not used by admin.ejs (hardcoded months) but good to keep structure
                    data: monthsData
                };
            }

            // Libros más prestados (Restored)
            if (Array.isArray(stats.librosMasPrestados)) {
                stats.librosMasPrestados = {
                    labels: stats.librosMasPrestados.map(l => l.titulo),
                    data: stats.librosMasPrestados.map(l => l.totalPrestamos)
                };
            }

            // KPI 1: Libros por año (Restored)
            if (Array.isArray(stats.librosPorAnio)) {
                stats.librosPorAnio = {
                    labels: stats.librosPorAnio.map(d => d.anio),
                    data: stats.librosPorAnio.map(d => d.total)
                };
            }

            // NUEVO: Procesar prestamos por semana (Lunes-Viernes)
            stats.dataLibrosPorSemana = [0, 0, 0, 0, 0];
            stats.labelsLibrosPorSemana = [];

            const diasSemanaNombres = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
            for (let i = 0; i < 5; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                const diaMes = `${d.getDate()}/${d.getMonth() + 1}`;
                stats.labelsLibrosPorSemana.push(`${diasSemanaNombres[i]} ${diaMes}`);
            }

            if (Array.isArray(stats.prestamosSemana)) {
                console.log('Raw DB Data:', stats.prestamosSemana);
                stats.prestamosSemana.forEach(day => {
                    const index = day.day_index;
                    // 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri
                    if (index >= 0 && index <= 4) {
                        stats.dataLibrosPorSemana[index] = day.total;
                    }
                });
            }
            console.log('Chart Labels:', stats.labelsLibrosPorSemana);
            console.log('Chart Data:', stats.dataLibrosPorSemana);





            // KPI 2: Comparativa 1er vs 5to Grado
            if (Array.isArray(stats.comparativaGrados)) {
                const grado1 = stats.comparativaGrados.find(g => g.grado === 1) || { total_libros: 0 };
                const grado5 = stats.comparativaGrados.find(g => g.grado === 5) || { total_libros: 0 };
                stats.comparativaGrados = {
                    labels: ['1er Grado', '5to Grado'],
                    data: [grado1.total_libros, grado5.total_libros]
                };
            }

            // KPI 3: Ranking de Grados
            if (Array.isArray(stats.rankingGrados)) {
                stats.rankingGrados = {
                    labels: stats.rankingGrados.map(g => `${g.grado}° Grado`),
                    data: stats.rankingGrados.map(g => g.total_libros)
                };
            }

            // Total de préstamos por grado
            if (Array.isArray(stats.porGrado)) {
                stats.porGrado = {
                    labels: stats.porGrado.map(p => (p.grado ? `${p.grado}° Grado` : '')),
                    data: stats.porGrado.map(p => p.total)
                };
            }

            // Obtener estadísticas del admin (libros agregados, estudiantes activos, préstamos supervisados)
            const adminStats = await Usuario.obtenerEstadisticasDocente(req.user.id);
            stats.adminStats = {
                librosAgregados: adminStats?.librosAgregados || 0,
                estudiantesActivos: adminStats?.estudiantesActivos || 0,
                prestamosSupervisados: adminStats?.prestamosSupervisados || 0
            };

            res.render('dashboard/admin', {
                usuario: req.user,
                stats
            });
        } catch (error) {
            console.error(error);
            next(error);
        }
    },

    // NUEVO: Dashboard docente (solo docentes)
    async getDocenteStats(req, res, next) {
        try {
            const userId = req.user.id;

            // 1. Estadísticas personales (UsuarioModel)
            const estadisticasDocente = await Usuario.obtenerEstadisticasDocente(userId);

            // 2. Estadísticas globales para gráficos (DashboardModel)
            const statsGlobales = await DashboardModel.getDocenteStats();

            // 3. Préstamos activos del docente (para la tabla)
            const proximasDevoluciones = await DashboardModel.getProximasDevoluciones(userId);

            // 4. Obtener estadísticas de lectura (progreso, historial) reutilizando la lógica de estudiante
            const statsLectura = await DashboardModel.getEstudianteStats(userId);

            // 5. Actividad Diaria (Últimos 7 días)
            const actividadRaw = await DashboardModel.getActividadReciente(userId);
            const dailyMap = new Map();
            const daysLabels = [];
            const daysData = [];

            // Generate last 7 days
            for (let i = 6; i >= 0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                // Key: YYYY-MM-DD for matching
                const key = d.toISOString().split('T')[0];
                // Label: Day Name (e.g. "Lun")
                const label = d.toLocaleDateString('es-PE', { weekday: 'short' });
                dailyMap.set(key, { label, total: 0 });
            }

            if (Array.isArray(actividadRaw)) {
                actividadRaw.forEach(a => {
                    // a.fecha might be Date object or string depending on driver
                    let dateStr;
                    if (a.fecha instanceof Date) dateStr = a.fecha.toISOString().split('T')[0];
                    else dateStr = String(a.fecha).split('T')[0];

                    if (dailyMap.has(dateStr)) {
                        const current = dailyMap.get(dateStr);
                        current.total = a.total;
                        dailyMap.set(dateStr, current);
                    }
                });
            }

            const actividadDiariaChart = {
                labels: Array.from(dailyMap.values()).map(v => v.label),
                data: Array.from(dailyMap.values()).map(v => v.total)
            };

            // --- PROCESAMIENTO DE MESES (Jan - Dec) ---
            const mesesMap = new Map();
            const today = new Date();
            const currentYear = today.getFullYear();
            const nombresMeses = [
                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
            ];
            for (let i = 0; i < 12; i++) {
                const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                mesesMap.set(key, { label: nombresMeses[i], total: 0 });
            }

            // A. Histórico PERSONAL (Docente)
            let historicoMensualChart = { labels: [], data: [] };
            if (Array.isArray(statsLectura.historicoMensual)) {
                // Clonar mapa para personal
                const mapPersonal = new Map(JSON.parse(JSON.stringify(Array.from(mesesMap))));

                statsLectura.historicoMensual.forEach(h => {
                    if (mapPersonal.has(h.mes)) {
                        const current = mapPersonal.get(h.mes);
                        current.total = h.total;
                        mapPersonal.set(h.mes, current);
                    }
                });

                historicoMensualChart = {
                    labels: Array.from(mapPersonal.values()).map(v => v.label),
                    data: Array.from(mapPersonal.values()).map(v => v.total)
                };
            }

            // B. Histórico GLOBAL (Todos los usuarios) - Reemplaza a "librosPorAnio"
            let globalMensualChart = { labels: [], data: [] };
            if (Array.isArray(statsGlobales.librosPorAnio)) { // En el modelo ahora retorna por mes
                // Clonar mapa para global
                const mapGlobal = new Map(JSON.parse(JSON.stringify(Array.from(mesesMap))));

                statsGlobales.librosPorAnio.forEach(h => { // h.mes comes from query
                    if (mapGlobal.has(h.mes)) {
                        const current = mapGlobal.get(h.mes);
                        current.total = h.total;
                        mapGlobal.set(h.mes, current);
                    }
                });

                globalMensualChart = {
                    labels: Array.from(mapGlobal.values()).map(v => v.label),
                    data: Array.from(mapGlobal.values()).map(v => v.total)
                };
            }


            // Preparar datos para gráficos
            const stats = {
                docente: {
                    ...estadisticasDocente,
                    progresoLecturaGlobal: statsLectura.progreso, // Progreso gamificado
                    historicoMensual: historicoMensualChart // Historial personal formateado
                },
                proximasDevoluciones: proximasDevoluciones, // Nueva propiedad para la vista

                // Gráfico: Libros más populares (Global)
                librosMasPrestados: {
                    labels: statsGlobales.librosMasPrestados.map(l => l.titulo),
                    data: statsGlobales.librosMasPrestados.map(l => l.totalPrestamos)
                },

                // Gráfico: Histórico MENSUAL Global (renombrado conceptualmente, mantenemos key para compat)
                librosPorAnio: globalMensualChart,

                // Gráfico: Ranking por Grados (Global - Año Actual)
                rankingGrados: {
                    labels: statsGlobales.rankingGrados.map(g => `${g.grado}° Grado`),
                    data: statsGlobales.rankingGrados.map(g => g.total_libros)
                },

                // Gráfico: Actividad Diaria
                actividadDiaria: actividadDiariaChart
            };

            res.render('dashboard/docente', {
                usuario: req.user,
                stats
            });
        } catch (error) {
            console.error('Error en getDocenteStats:', error);
            next(error);
        }
    },

    // Dashboard estudiante
    async getEstudianteStats(req, res, next) {
        try {
            // Actualizar estados de préstamos vencidos antes de cargar dashboard
            await Prestamo.verificarVencidos();

            const stats = await DashboardModel.getEstudianteStats(req.user.id);

            // 1. Histórico Mensual (AÑO COMPLETO Enero-Diciembre)
            if (Array.isArray(stats.historicoMensual)) {
                const mesesMap = new Map();
                const today = new Date();
                const currentYear = today.getFullYear();

                const nombresMeses = [
                    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                ];

                for (let i = 0; i < 12; i++) {
                    const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                    mesesMap.set(key, { label: nombresMeses[i], total: 0 });
                }

                stats.historicoMensual.forEach(h => {
                    if (mesesMap.has(h.mes)) {
                        const current = mesesMap.get(h.mes);
                        current.total = h.total;
                        mesesMap.set(h.mes, current);
                    }
                });

                stats.historicoMensual = {
                    labels: Array.from(mesesMap.values()).map(v => v.label),
                    data: Array.from(mesesMap.values()).map(v => v.total)
                };
            }

            // 2. Categorías
            if (Array.isArray(stats.categorias)) {
                stats.categorias = {
                    labels: stats.categorias.map(c => c.nombre),
                    data: stats.categorias.map(c => c.total)
                };
            }

            res.render('dashboard/estudiante', {
                usuario: req.user,
                stats
            });
        } catch (error) {
            console.error(error);
            next(error);
        }
    },

    // API para obtener top lectores filtrados (estudiantes o docentes)
    async getTopLectoresAPI(req, res) {
        try {
            const { periodo, grado, busqueda, tipo = 'estudiante', limit = 10 } = req.query;
            const filters = { limit, grado, busqueda, tipo };

            // Calcular fechas según periodo
            const now = new Date();
            let fechaInicio, fechaFin;

            switch (periodo) {
                case 'anio_anterior':
                    fechaInicio = new Date(now.getFullYear() - 1, 0, 1);
                    fechaFin = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
                    break;
                case 'anio_actual':
                    fechaInicio = new Date(now.getFullYear(), 0, 1);
                    fechaFin = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                    break;
                case 'mes_actual':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'trimestre':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'bimestre':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'historico':
                default:
                    break;
            }

            if (fechaInicio) {
                filters.fechaInicio = fechaInicio.toISOString().split('T')[0];
                filters.fechaFin = fechaFin ? fechaFin.toISOString().split('T')[0] : null;
            }

            const data = await RankingModel.obtenerRankingLectores(filters);

            console.log(`Top lectores ${tipo}:`, data.length, 'resultados');
            res.json({ success: true, data });
        } catch (error) {
            console.error('Error en getTopLectoresAPI:', error);
            res.status(500).json({ success: false, message: 'Error al obtener datos: ' + error.message });
        }
    },

    // API para obtener prestamos por grado filtrados
    async getPrestamosPorGradoAPI(req, res) {
        try {
            const { periodo } = req.query;
            const filters = {};

            // Calcular fechas según periodo
            const now = new Date();
            let fechaInicio, fechaFin;

            const dayjs = require('dayjs');
            // Ensure locale is set if needed for any formatting, though here we just need dates
            // require('dayjs/locale/es'); 
            // dayjs.locale('es');

            switch (periodo) {
                case 'anio_anterior':
                    fechaInicio = new Date(now.getFullYear() - 1, 0, 1);
                    fechaFin = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
                    break;
                case 'anio_actual':
                    fechaInicio = new Date(now.getFullYear(), 0, 1);
                    fechaFin = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
                    break;
                case 'mes_actual':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth(), 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'trimestre':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth() - 2, 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'bimestre':
                    fechaInicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    fechaFin = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
                    break;
                case 'historico':
                default:
                    break;
            }

            if (fechaInicio) {
                filters.fechaInicio = fechaInicio.toISOString().split('T')[0];
                filters.fechaFin = fechaFin ? fechaFin.toISOString().split('T')[0] : null;
            }

            const data = await DashboardModel.obtenerEstadisticasPorGrado(filters);
            res.json({ success: true, data });
        } catch (error) {
            console.error('Error en getPrestamosPorGradoAPI:', error);
            res.status(500).json({ success: false, message: 'Error al obtener datos: ' + error.message });
        }
    }
};

module.exports = DashboardController;
