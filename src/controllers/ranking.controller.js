const RankingModel = require('../models/ranking.model');

class RankingController {
    static async obtenerRanking(req, res, next) {
        try {
            const { 
                busqueda, 
                grado, 
                fechaInicio, 
                fechaFin,
                tipo = 'estudiante' // Por defecto estudiantes
            } = req.query;

            const limit = 100;

            const ranking = await RankingModel.obtenerRankingLectores({
                limit,
                busqueda,
                grado: tipo === 'estudiante' ? grado : null, // Solo aplicar filtro de grado para estudiantes
                fechaInicio,
                fechaFin,
                tipo
            });

            res.render('ranking/lectores', { 
                ranking, 
                usuario: req.user,
                busqueda: busqueda || '',
                grado: grado || '',
                fechaInicio: fechaInicio || '',
                fechaFin: fechaFin || ''
            });
        } catch (err) {
            console.error('Error en obtenerRankingLectores:', err);
            next(err);
        }
    }
}

module.exports = RankingController;
