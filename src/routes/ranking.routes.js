const express = require('express');
const router = express.Router();
const RankingController = require('../controllers/ranking.controller');
const { verifyToken } = require('../middlewares/auth.middleware');

// Ruta para el ranking de estudiantes (valor por defecto)
router.get('/lectores', verifyToken, (req, res, next) => {
    req.query.tipo = 'estudiante';
    return RankingController.obtenerRanking(req, res, next);
});

// Ruta para el ranking de docentes
router.get('/docentes', verifyToken, (req, res, next) => {
    req.query.tipo = 'docente';
    return RankingController.obtenerRanking(req, res, next);
});

module.exports = router;
