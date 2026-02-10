const LogroModel = require('../models/logro.model');
const PrestamoModel = require('../models/prestamo.model');

class LogrosService {
    /**
     * Recalcula lecturas completas (préstamos con fecha_devolucion_real no nula) y asigna logros según umbrales
     * @param {number} usuarioId
     */
    static async evaluarYAsignarLogros(usuarioId) {
        // 1. Contar préstamos devueltos por el usuario
        const leidos = await PrestamoModel.countDevolucionesPorUsuario(usuarioId);
        // 2. Obtener todos los logros ordenados por umbral asc
        const logros = await LogroModel.obtenerTodos();

        // 3. Obtener logros ya otorgados
        const otorgados = await LogroModel.obtenerLogrosUsuario(usuarioId);
        const otorgadosIds = new Set(otorgados.map(l => l.id));

        const asignados = [];

        for (const logro of logros) {
            if (leidos >= logro.umbral && !otorgadosIds.has(logro.id)) {
                await LogroModel.asignarLogroAUsuario(usuarioId, logro.id);
                asignados.push(logro);
            }
        }

        return { leidos, asignados };
    }
}

module.exports = LogrosService;
